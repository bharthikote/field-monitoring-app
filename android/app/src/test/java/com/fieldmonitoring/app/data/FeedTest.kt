package com.fieldmonitoring.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class FeedTest {
    private val dir: File = Files.createTempDirectory("feed").toFile()
    private fun photo(name: String) = File(dir, "$name.jpg").apply { writeText("jpeg") }.path

    @Test fun aPostNeedsAtLeastOnePhotoAndAtMostTen() {
        assertEquals("Add at least one photo", FeedRules.validate(FeedDraft("c1", "Great harvest")))
        assertEquals("At most 10 photos per post", FeedRules.validate(FeedDraft("c1", "", photos = List(11) { "p$it" })))
        assertNull(FeedRules.validate(FeedDraft("c1", "", photos = listOf("p"))))
    }

    @Test fun shareTextHasStoryAuthorPlaceAndLink() {
        val post = FeedPost(
            id = "p1", caption = "Tomato yield doubled after staking", authorName = "Asha",
            villageName = "Hosur", countryName = "India", shareUrl = "https://x.onrender.com/s/abc",
        )
        val text = FeedRules.shareText(post)
        assertTrue(text.startsWith("Tomato yield doubled after staking"))
        assertTrue(text.contains("Story from the field by Asha - Hosur, India"))
        assertTrue(text.endsWith("https://x.onrender.com/s/abc"))
    }

    @Test fun longCaptionsAreShortenedInShares() {
        val post = FeedPost(id = "p1", caption = "x".repeat(300), authorName = "A", shareUrl = "u")
        assertTrue(FeedRules.shareText(post).startsWith("x".repeat(140) + "..."))
    }

    @Test fun feedParsesServerJson() {
        val page = AppJson.decodeFromString<FeedPage>(
            """{"posts":[{"id":"p1","caption":"Hi","created_at":"2026-11-23T10:00:00Z","author_id":"u1","author_name":"Asha",
               "author_role":"tfo","village_name":"Hosur","country_name":"India","photos":["https://a/1.jpg","https://a/2.jpg"],
               "like_count":3,"comment_count":1,"liked_by_me":true,"share_url":"https://h/s/t","can_delete":false}]}""",
        )
        val p = page.posts.single()
        assertEquals(2, p.photos.size)
        assertTrue(p.likedByMe)
        assertEquals("Hosur, India", p.place)
    }

    // --- Written offline, posted on sync ---

    private val store = FakeStore()
    private val remote = FakeRemote()
    private val deleted = mutableListOf<String>()
    private val repo = Repository(store, remote, Dispatchers.Unconfined, deleteFile = { deleted += it })

    @Test fun postWaitsOfflineThenGoesUpWithPhotosInOrder() = runBlocking {
        val photos = listOf(photo("a"), photo("b"))
        assertNull(repo.saveFeedPost(FeedDraft("c1", " Great harvest ", "v1", photos)))
        assertEquals(1, repo.unsentFeedPosts().size)

        remote.answers += { """{"post":{"id":"p1"}}""" }
        repo.syncNow()

        val fields = remote.posted.single().toMap()
        assertEquals("c1", fields["clientId"])
        assertEquals("Great harvest", fields["caption"])
        assertEquals("v1", fields["villageId"])
        assertTrue(repo.unsentFeedPosts().isEmpty())
        assertEquals(photos, deleted) // local copies cleaned up once posted
    }

    @Test fun refusedPostKeepsItsPhotosAndNeedsAttention() = runBlocking {
        repo.saveFeedPost(FeedDraft("c1", "", photos = listOf(photo("a"))))
        remote.answers += { throw ApiException("A photo is too large (max 8MB each)", status = 400) }
        repo.syncNow()
        val (record, _) = repo.unsentFeedPosts().single()
        assertEquals(RecordState.ATTENTION, record.state)
        assertFalse(deleted.isNotEmpty())
    }

    @Test fun likesAndRemovalsGoToTheRightEndpoints() = runBlocking {
        repo.setLiked("p1", true)
        repo.setLiked("p1", false)
        repo.deletePost("p2")
        repo.deleteComment("c9")
        assertEquals("/feed/p1/like", remote.jsonPosts.single().first)
        assertEquals(listOf("/feed/p1/like", "/feed/p2", "/feed/comments/c9"), remote.deletes)
    }
}
