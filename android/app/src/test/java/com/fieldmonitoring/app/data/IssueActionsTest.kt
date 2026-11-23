package com.fieldmonitoring.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IssueActionsTest {
    private fun issue(status: String, holder: String? = "me", raiser: String = "other", ack: Boolean = false) = Issue(
        id = "i1", demoPlotId = "p1", status = status, issueTypeName = "Wilting",
        acknowledgeOnly = ack, assignedToId = holder, raisedById = raiser, villageId = "v1",
    )

    private fun names(i: Issue, me: String = "me") = IssueAction.available(i, me).map { it.name }

    @Test fun holderOfAnAssignedIssueCanStartResolveReassignOrDispute() =
        assertEquals(listOf("Start", "Resolve", "Reassign", "Dispute"), names(issue("assigned")))

    @Test fun inProgressNoLongerOffersStart() =
        assertEquals(listOf("Resolve", "Reassign", "Dispute"), names(issue("in_progress")))

    @Test fun acknowledgeOnlyTypesAreAcknowledgedNotResolved() =
        assertEquals(listOf("Start", "Acknowledge", "Reassign", "Dispute"), names(issue("assigned", ack = true)))

    @Test fun theRaiserCannotDisputeTheirOwnIssue() =
        assertEquals(listOf("Start", "Resolve", "Reassign"), names(issue("assigned", raiser = "me")))

    @Test fun verifierApprovesOrRejects() =
        assertEquals(listOf("Approve", "Reject"), names(issue("pending_verification")))

    @Test fun disputeReviewerDecidesGenuineOrDismiss() =
        assertEquals(listOf("Genuine", "Dismiss"), names(issue("disputed")))

    @Test fun raiserAssignsAnIssueNobodyWasFoundFor() =
        assertEquals(listOf("Assign"), names(issue("raised", holder = null, raiser = "me")))

    @Test fun nothingForSomeoneWhoIsNotTheHolder() {
        assertTrue(names(issue("assigned", holder = "someone-else")).isEmpty())
        assertTrue(names(issue("closed")).isEmpty())
    }

    @Test fun bodiesMatchWhatTheServerReads() {
        assertEquals("""{"approved":false,"note":"Still wilting"}""", IssueAction.Reject.body(" Still wilting "))
        assertEquals("""{"genuine":true,"note":""}""", IssueAction.Genuine.body(""))
        assertEquals("""{"assignedTo":"u9","comment":"Board is the TL's job"}""", IssueAction.Reassign.body("Board is the TL's job", "u9"))
        assertEquals("{}", IssueAction.Start.body(""))
    }

    // --- Queued through the outbox ---

    private val store = FakeStore()
    private val remote = FakeRemote()
    private val repo = Repository(store, remote, Dispatchers.Unconfined)

    @Test fun actionIsSavedOfflineAndSentOnSync() = runBlocking {
        assertNull(repo.saveIssueAction(issue("assigned"), IssueAction.Resolve, "Sprayed neem oil", "c1"))
        assertEquals(1, repo.status.value.pending)
        assertNotNull(repo.pendingIssueAction("i1"))

        repo.syncNow()

        assertEquals("/issues/i1/resolve" to """{"note":"Sprayed neem oil"}""", remote.jsonPosts.single())
        assertEquals(RecordState.SENT, store.records.getValue("c1").state)
        assertNull("sent actions no longer block the issue", repo.pendingIssueAction("i1"))
    }

    @Test fun requiredNoteIsEnforced() =
        assertEquals("Please add a note", repo.saveIssueAction(issue("assigned"), IssueAction.Dispute, " ", "c1"))

    @Test fun onlyOneUnsentActionPerIssue() {
        repo.saveIssueAction(issue("assigned"), IssueAction.Start, "", "c1")
        assertEquals(
            "An action for this issue is already waiting to be sent",
            repo.saveIssueAction(issue("assigned"), IssueAction.Resolve, "", "c2"),
        )
    }

    @Test fun reassignCannotBeQueued() =
        assertEquals("Reassign needs a connection", repo.saveIssueAction(issue("assigned"), IssueAction.Reassign, "x", "c1"))

    @Test fun refusedActionNeedsAttentionWithTheServersReason() = runBlocking {
        repo.saveIssueAction(issue("assigned"), IssueAction.Start, "", "c1")
        remote.jsonAnswers += { throw ApiException("This issue is not waiting to be started", status = 400) }
        repo.syncNow()
        val record = store.records.getValue("c1")
        assertEquals(RecordState.ATTENTION, record.state)
        assertEquals("This issue is not waiting to be started", record.error)
        assertEquals(1, repo.status.value.attention)
    }
}
