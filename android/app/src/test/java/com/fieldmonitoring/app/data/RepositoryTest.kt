package com.fieldmonitoring.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class RepositoryTest {
    private val store = FakeStore()
    private val remote = FakeRemote()
    private val deleted = mutableListOf<String>()
    private var clock = 1_000L
    private val repo = Repository(store, remote, Dispatchers.Unconfined, { clock++ }, { deleted += it })
    private val photoDir: File = Files.createTempDirectory("fs-test").toFile()

    private fun draft(id: String, plot: String = "plot-1"): VisitDraft {
        val photo = File(photoDir, "$id.jpg").apply { writeText("jpeg") }
        return VisitDraft(
            clientId = id,
            demoPlotId = plot,
            plotType = "demo",
            actionPlan = "Plan",
            comments = "Fine",
            photos = mapOf(VisitRules.OVERALL_PHOTO to photo.path),
        )
    }

    private val ok = { """{"visit":{"id":"server-1","createdAt":"2026-11-23T00:00:00Z"},"skippedIssues":[]}""" }

    @Test fun savingAnIncompleteVisitKeepsNothing() {
        assertEquals("Enter the action plan", repo.saveVisit(draft("a").copy(actionPlan = "")))
        assertTrue(store.records.isEmpty())
    }

    @Test fun savedVisitWaitsAsPendingAndIsCounted() {
        assertNull(repo.saveVisit(draft("a")))
        assertEquals(RecordState.PENDING, store.records.getValue("a").state)
        assertEquals(1, repo.status.value.pending)
    }

    @Test fun syncSendsOldestFirstWithClientIdAndDeletesPhotos() = runBlocking {
        repo.saveVisit(draft("first"))
        repo.saveVisit(draft("second"))
        remote.answers += ok
        remote.answers += ok

        val status = repo.syncNow()

        assertEquals(listOf("first", "second"), remote.posted.map { it.toMap()["clientId"] })
        assertEquals(RecordState.SENT, store.records.getValue("first").state)
        assertEquals("server-1", store.records.getValue("first").serverId)
        assertEquals(2, deleted.size)
        assertEquals(0, status.pending)
        assertNull(status.lastError)
        assertNotNull(status.lastSyncAt)
        assertTrue("bundle refreshed after sending", repo.hasBundle())
    }

    @Test fun noConnectionStopsAndKeepsEverything() = runBlocking {
        repo.saveVisit(draft("a"))
        repo.saveVisit(draft("b"))
        remote.answers += { throw ApiException("No connection", offline = true) }

        val status = repo.syncNow()

        assertEquals(1, remote.posted.size) // stopped after the first failure
        assertEquals(2, status.pending)
        assertTrue(status.lastError!!.contains("No connection"))
        assertTrue(deleted.isEmpty())
    }

    @Test fun rejectedVisitNeedsAttentionAndTheRestCarryOn() = runBlocking {
        repo.saveVisit(draft("bad"))
        repo.saveVisit(draft("good"))
        remote.answers += { throw ApiException("This demo plot isn't in your assigned coverage", status = 403) }
        remote.answers += ok

        val status = repo.syncNow()

        assertEquals(RecordState.ATTENTION, store.records.getValue("bad").state)
        assertEquals("This demo plot isn't in your assigned coverage", store.records.getValue("bad").error)
        assertEquals(RecordState.SENT, store.records.getValue("good").state)
        assertEquals(1, status.attention)
        assertFalse("rejected visit keeps its photo for a retry", deleted.any { it.endsWith("bad.jpg") })
    }

    @Test fun retryPutsAttentionBackInTheQueue() = runBlocking {
        repo.saveVisit(draft("a"))
        remote.answers += { throw ApiException("Server error (500)", status = 500) }
        repo.syncNow()
        repo.retryRecord("a")
        remote.answers += ok
        repo.syncNow()
        assertEquals(RecordState.SENT, store.records.getValue("a").state)
    }

    @Test fun missingPhotoIsFlaggedNotSent() = runBlocking {
        val d = draft("a")
        repo.saveVisit(d)
        File(d.photos.getValue(VisitRules.OVERALL_PHOTO)).delete()
        repo.syncNow()
        assertEquals(RecordState.ATTENTION, store.records.getValue("a").state)
        assertTrue(remote.posted.isEmpty())
    }

    @Test fun logoutIsRefusedWhileWorkIsUnsentUnlessForced() {
        repo.saveVisit(draft("a"))
        assertFalse(repo.logout(force = false))
        assertEquals(1, store.records.size)
        assertTrue(repo.logout(force = true))
        assertTrue(store.records.isEmpty())
        assertEquals(1, deleted.size)
    }

    @Test fun loginStoresTheSession() = runBlocking {
        val user = repo.login("9876543210", "secret")
        assertEquals("Asha", user.name)
        assertEquals("t", repo.session()?.token)
    }

    @Test fun historyShowsUnsentVisitsForThatPlotOnly() {
        repo.saveVisit(draft("a", plot = "plot-1"))
        repo.saveVisit(draft("b", plot = "plot-2"))
        val history = repo.visitHistory("plot-1")
        assertEquals(listOf("a"), history.map { it.key })
        assertEquals(RecordState.PENDING, history.single().localState)
    }

    @Test fun bundleParsesServerJsonIncludingNumericStrings() = runBlocking {
        remote.bundle = """
            {"serverTime":"t","villages":[{"id":"v1","name":"Hosur","block_name":"B"}],
             "farmers":[{"id":"f1","name":"Asha","phone":"123456789","age":34,"village_id":"v1","social_media":["facebook"]}],
             "demoPlots":[{"id":"p1","farmer_id":"f1","farmer_name":"Asha","farmer_phone":"123456789","demo_status":"ongoing",
               "plot_type":"demo","gps_lat":"12.9716","gps_lng":"77.5946","crop_name":"Tomato","variety_name":"Padma F1","village_id":"v1"}],
             "openIssues":[],
             "master":{"issueTypes":[{"id":"i1","name":"Wilting","acknowledge_only":null,"country_ids":[]}]}}
        """.trimIndent()
        val bundle = repo.downloadBundle()
        assertEquals("Hosur", bundle.villages.single().name)
        assertEquals(34, bundle.farmers.single().age)
        assertEquals("12.9716", bundle.demoPlots.single().gpsLat)
        assertFalse(bundle.master.issueTypes.single().acknowledgeOnly)
    }
}
