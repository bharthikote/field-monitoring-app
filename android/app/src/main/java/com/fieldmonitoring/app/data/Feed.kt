package com.fieldmonitoring.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A story on the Feed (GET /feed). */
@Serializable
data class FeedPost(
    val id: String,
    val caption: String = "",
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("author_id") val authorId: String = "",
    @SerialName("author_name") val authorName: String = "",
    @SerialName("author_role") val authorRole: String? = null,
    @SerialName("village_name") val villageName: String? = null,
    @SerialName("country_name") val countryName: String? = null,
    val photos: List<String> = emptyList(),
    @SerialName("like_count") val likeCount: Int = 0,
    @SerialName("comment_count") val commentCount: Int = 0,
    @SerialName("liked_by_me") val likedByMe: Boolean = false,
    @SerialName("share_url") val shareUrl: String = "",
    @SerialName("can_delete") val canDelete: Boolean = false,
) {
    val place: String get() = listOfNotNull(villageName, countryName).joinToString(", ")
}

@Serializable
data class FeedPage(val posts: List<FeedPost> = emptyList())

@Serializable
data class FeedComment(
    val id: String,
    val body: String,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("author_name") val authorName: String = "",
    @SerialName("author_role") val authorRole: String? = null,
    @SerialName("can_delete") val canDelete: Boolean = false,
)

@Serializable
data class FeedComments(val comments: List<FeedComment> = emptyList())

/** A post written on the phone, waiting in the outbox (kind "feed_post"). */
@Serializable
data class FeedDraft(
    val clientId: String,
    val caption: String,
    val villageId: String? = null,
    val photos: List<String> = emptyList(), // local JPEGs, in order
    val createdAtMillis: Long = 0,
)

object FeedRules {
    const val MAX_PHOTOS = 10
    const val MAX_CAPTION = 2200

    fun validate(d: FeedDraft): String? = when {
        d.photos.isEmpty() -> "Add at least one photo"
        d.photos.size > MAX_PHOTOS -> "At most $MAX_PHOTOS photos per post"
        d.caption.length > MAX_CAPTION -> "Keep the caption under $MAX_CAPTION characters"
        else -> null
    }

    fun formFields(d: FeedDraft): List<Pair<String, String>> = buildList {
        add("clientId" to d.clientId)
        add("caption" to d.caption.trim())
        d.villageId?.let { add("villageId" to it) }
    }

    /** Photos go up in order as photo_0, photo_1, ... */
    fun fileField(index: Int) = "photo_$index"

    /** The text that goes with a shared link (WhatsApp, SMS, email...). */
    fun shareText(post: FeedPost): String {
        val intro = post.caption.trim().take(140).let { if (post.caption.trim().length > 140) "$it..." else it }
        val who = listOf(post.authorName, post.place).filter { it.isNotBlank() }.joinToString(" - ")
        return listOf(intro, "Story from the field by $who", post.shareUrl).filter { it.isNotBlank() }.joinToString("\n\n")
    }
}
