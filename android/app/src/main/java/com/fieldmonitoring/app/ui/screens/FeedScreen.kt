package com.fieldmonitoring.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.data.ApiException
import com.fieldmonitoring.app.data.FeedComment
import com.fieldmonitoring.app.data.FeedDraft
import com.fieldmonitoring.app.data.FeedPost
import com.fieldmonitoring.app.data.FeedRules
import com.fieldmonitoring.app.data.Photos
import com.fieldmonitoring.app.data.RecordState
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.ConfirmDialog
import com.fieldmonitoring.app.ui.components.CreateButton
import com.fieldmonitoring.app.ui.components.DangerButton
import com.fieldmonitoring.app.ui.components.DangerChip
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.components.ErrorText
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.FsTextField
import com.fieldmonitoring.app.ui.components.PickOption
import com.fieldmonitoring.app.ui.components.PillKind
import com.fieldmonitoring.app.ui.components.RemoteImage
import com.fieldmonitoring.app.ui.components.SearchPicker
import com.fieldmonitoring.app.ui.components.SectionTitle
import com.fieldmonitoring.app.ui.components.SelectField
import com.fieldmonitoring.app.ui.components.StatusPill
import com.fieldmonitoring.app.ui.components.TonalButton
import com.fieldmonitoring.app.ui.components.TonalChip
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * Feed: success and impact stories from the field, newest first, for
 * everyone in every country. Like, comment and share as a link that anyone
 * can open. The first page is kept on the phone so it shows offline; new
 * posts are written offline and wait in the outbox.
 */
@Composable
fun FeedScreen(vm: AppViewModel) {
    val scope = rememberCoroutineScope()
    val posts = remember { mutableStateListOf<FeedPost>().apply { addAll(vm.repo.cachedFeed()) } }
    var note by remember { mutableStateOf<String?>(null) }
    var loadingMore by remember { mutableStateOf(false) }
    var endReached by remember { mutableStateOf(false) }
    val unsent = remember(vm.dataVersion) { vm.repo.unsentFeedPosts() }

    LaunchedEffect(vm.dataVersion) {
        note = try {
            val fresh = vm.repo.fetchFeed()
            posts.clear(); posts.addAll(fresh)
            endReached = fresh.size < 20
            null
        } catch (e: ApiException) {
            if (e.offline) "Offline - showing the stories saved on this phone" else e.message
        } catch (e: Exception) {
            "Couldn't refresh the feed"
        }
    }

    fun loadMore() {
        if (loadingMore || endReached || posts.isEmpty()) return
        loadingMore = true
        scope.launch {
            try {
                val more = vm.repo.fetchFeed(before = posts.last().createdAt)
                posts.addAll(more.filter { m -> posts.none { it.id == m.id } })
                endReached = more.size < 20
            } catch (_: Exception) {
            } finally {
                loadingMore = false
            }
        }
    }

    LazyColumn(
        Modifier.fillMaxSize().background(Fs.Background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    SectionTitle("Feed")
                    Text("Stories from the field", style = FsText.Label)
                }
                CreateButton("New Post", { vm.open(Screen.NewPost) }, icon = AppIcons.Add)
            }
            note?.let { Text(it, style = FsText.Label, modifier = Modifier.padding(top = 8.dp)) }
        }
        items(unsent, key = { "local-" + it.first.id }) { (record, draft) ->
            FsCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Your new story", color = Fs.Primary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    if (record.state == RecordState.ATTENTION) StatusPill("Needs attention", PillKind.Attention)
                    else StatusPill("Pending sync", PillKind.Pending)
                }
                Spacer(Modifier.height(10.dp))
                RemoteImage(draft.photos.first(), Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(FsShape.Control))
                if (draft.photos.size > 1) Text("+${draft.photos.size - 1} more photos", style = FsText.Label)
                if (draft.caption.isNotBlank()) Text(draft.caption, color = Fs.OnSurface, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp), maxLines = 3)
                if (record.state == RecordState.ATTENTION) {
                    Text(record.error ?: "The server refused this post", color = Fs.Danger, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 8.dp)) {
                        TonalChip("Try again") { vm.retryRecord(record.id) }
                        DangerChip("Discard") { vm.discardRecord(record.id) }
                    }
                }
            }
        }
        if (posts.isEmpty() && unsent.isEmpty()) {
            item { EmptyState("No stories yet. Share the first success from the field!") }
        }
        itemsIndexed(posts, key = { _, p -> p.id }) { index, post ->
            if (index >= posts.size - 3) LaunchedEffect(post.id) { loadMore() }
            PostCard(
                vm = vm,
                post = post,
                onChanged = { updated -> posts.indexOfFirst { it.id == updated.id }.takeIf { it >= 0 }?.let { posts[it] = updated } },
                onDeleted = { posts.removeAll { it.id == post.id } },
            )
        }
        if (loadingMore) item { Text("Loading more...", style = FsText.Label) }
    }
}

@Composable
private fun PostCard(vm: AppViewModel, post: FeedPost, onChanged: (FeedPost) -> Unit, onDeleted: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }

    Card(
        shape = FsShape.Card,
        colors = CardDefaults.cardColors(containerColor = Fs.Surface),
        elevation = CardDefaults.cardElevation(2.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        // Author
        Row(Modifier.padding(start = 14.dp, end = 4.dp, top = 12.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(Fs.PrimaryContainer), contentAlignment = Alignment.Center) {
                Text(post.authorName.take(1).uppercase(), color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text(post.authorName, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    listOfNotNull(post.authorRole?.let(Format::role), post.place.ifBlank { null }).joinToString(" · "),
                    style = FsText.Label,
                )
            }
            if (post.canDelete) {
                IconButton({ confirmDelete = true }) { Icon(AppIcons.Delete, "Remove post", tint = Fs.LabelMuted) }
            }
        }

        // Photos: swipe through, with dots
        val pager = rememberPagerState { post.photos.size }
        Box {
            HorizontalPager(pager, Modifier.fillMaxWidth().aspectRatio(1f)) { page ->
                RemoteImage(post.photos[page], Modifier.fillMaxSize())
            }
            if (post.photos.size > 1) {
                Text(
                    "${pager.currentPage + 1}/${post.photos.size}",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.align(Alignment.TopEnd).padding(10.dp)
                        .clip(FsShape.Pill).background(Color.Black.copy(alpha = 0.55f)).padding(horizontal = 10.dp, vertical = 3.dp),
                )
            }
        }
        if (post.photos.size > 1) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center) {
                repeat(post.photos.size) { i ->
                    Box(
                        Modifier.padding(horizontal = 3.dp).size(7.dp).clip(CircleShape)
                            .background(if (i == pager.currentPage) Fs.Leaf else Fs.Divider),
                    )
                }
            }
        }

        // Like · Comment · Share
        Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton({
                val liked = !post.likedByMe
                onChanged(post.copy(likedByMe = liked, likeCount = post.likeCount + if (liked) 1 else -1))
                scope.launch {
                    try {
                        vm.repo.setLiked(post.id, liked)
                    } catch (e: ApiException) {
                        onChanged(post) // put it back
                        vm.message = if (e.offline) "Liking needs a connection" else e.message
                    }
                }
            }) {
                Icon(
                    if (post.likedByMe) AppIcons.Heart else AppIcons.HeartOutline,
                    if (post.likedByMe) "Unlike" else "Like",
                    tint = if (post.likedByMe) Fs.Danger else Fs.OnSurface,
                )
            }
            IconButton({ vm.open(Screen.FeedComments(post.id)) }) { Icon(AppIcons.Chat, "Comments", tint = Fs.OnSurface) }
            IconButton({
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, "A story from the field")
                    putExtra(Intent.EXTRA_TEXT, FeedRules.shareText(post))
                }
                context.startActivity(Intent.createChooser(send, "Share story"))
            }) { Icon(AppIcons.Share, "Share", tint = Fs.OnSurface) }
        }
        Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp)) {
            if (post.likeCount > 0) {
                Text("${post.likeCount} like${if (post.likeCount == 1) "" else "s"}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Fs.OnSurface)
            }
            if (post.caption.isNotBlank()) {
                Text(
                    post.caption,
                    color = Fs.OnSurface,
                    fontSize = 15.sp,
                    maxLines = if (expanded) Int.MAX_VALUE else 3,
                    modifier = Modifier.padding(top = 4.dp).clickable { expanded = !expanded },
                )
            }
            if (post.commentCount > 0) {
                Text(
                    "View ${if (post.commentCount == 1) "1 comment" else "all ${post.commentCount} comments"}",
                    style = FsText.Label,
                    modifier = Modifier.padding(top = 6.dp).clickable { vm.open(Screen.FeedComments(post.id)) },
                )
            }
            Text(Format.dateTime(post.createdAt), style = FsText.Label, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Remove this story?",
            message = "It disappears from the Feed for everyone, and its share link stops working.",
            confirmText = "Remove",
            destructive = true,
            onDismiss = { confirmDelete = false },
            onConfirm = {
                confirmDelete = false
                scope.launch {
                    try {
                        vm.repo.deletePost(post.id)
                        onDeleted()
                        vm.message = "Story removed"
                    } catch (e: ApiException) {
                        vm.message = if (e.offline) "Removing needs a connection" else e.message
                    }
                }
            },
        )
    }
}

/** Comments on one story. Reading and writing comments need a connection. */
@Composable
fun FeedCommentsScreen(vm: AppViewModel, postId: String) {
    val scope = rememberCoroutineScope()
    val comments = remember { mutableStateListOf<FeedComment>() }
    var note by remember { mutableStateOf<String?>("Loading comments...") }
    var draft by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(postId, reload) {
        note = try {
            val list = vm.repo.fetchComments(postId)
            comments.clear(); comments.addAll(list)
            if (list.isEmpty()) "No comments yet - be the first." else null
        } catch (e: ApiException) {
            if (e.offline) "Comments need a connection." else e.message
        }
    }

    Column(Modifier.fillMaxSize().background(Fs.Background).imePadding()) {
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { SectionTitle("Comments") }
            note?.let { item { Text(it, style = FsText.Label) } }
            items(comments, key = { it.id }) { c ->
                FsCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(c.authorName, color = Fs.Primary, fontWeight = FontWeight.Bold)
                            Text(
                                listOfNotNull(c.authorRole?.let(Format::role), Format.dateTime(c.createdAt)).joinToString(" · "),
                                style = FsText.Label,
                                fontSize = 12.sp,
                            )
                        }
                        if (c.canDelete) {
                            IconButton({
                                scope.launch {
                                    try {
                                        vm.repo.deleteComment(c.id)
                                        comments.removeAll { it.id == c.id }
                                    } catch (e: ApiException) {
                                        vm.message = if (e.offline) "Removing needs a connection" else e.message
                                    }
                                }
                            }) { Icon(AppIcons.Delete, "Remove comment", tint = Fs.LabelMuted) }
                        }
                    }
                    Text(c.body, color = Fs.OnSurface, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().background(Fs.Surface).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FsTextField(null, draft, { draft = it.take(1000) }, Modifier.weight(1f), placeholder = "Add a comment...", singleLine = false)
            Spacer(Modifier.width(8.dp))
            IconButton({
                if (draft.isBlank() || sending) return@IconButton
                sending = true
                scope.launch {
                    try {
                        vm.repo.addComment(postId, draft, UUID.randomUUID().toString())
                        draft = ""
                        reload++
                    } catch (e: ApiException) {
                        vm.message = if (e.offline) "Commenting needs a connection" else e.message
                    } finally {
                        sending = false
                    }
                }
            }, enabled = draft.isNotBlank() && !sending) { Icon(AppIcons.Send, "Send", tint = Fs.Primary) }
        }
    }
}

/** Write a story: 1-10 photos (camera or gallery), a caption, optionally the village. Works offline. */
@Composable
fun NewPostScreen(vm: AppViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val villages = vm.bundle.villages
    val clientId = rememberSaveable { UUID.randomUUID().toString() }
    var caption by rememberSaveable { mutableStateOf("") }
    var villageId by rememberSaveable { mutableStateOf<String?>(null) }
    val photos = remember { mutableStateListOf<String>() }
    var pickingVillage by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun keep(uris: List<Uri>, cleanup: File? = null) {
        val room = FeedRules.MAX_PHOTOS - photos.size
        if (room <= 0) { error = "At most ${FeedRules.MAX_PHOTOS} photos per post"; return }
        busy = true
        scope.launch {
            uris.take(room).forEach { uri ->
                withContext(Dispatchers.IO) { Photos.keep(context, uri) }?.let { photos.add(it.path) }
            }
            cleanup?.delete()
            if (uris.size > room) error = "Only the first $room photos were added (max ${FeedRules.MAX_PHOTOS})"
            busy = false
        }
    }
    var cameraTarget by remember { mutableStateOf<Pair<File, Uri>?>(null) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        cameraTarget?.let { (file, uri) -> if (ok) keep(listOf(uri), file) else file.delete() }
        cameraTarget = null
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(FeedRules.MAX_PHOTOS)) { uris ->
        if (uris.isNotEmpty()) keep(uris)
    }

    Column(
        Modifier.fillMaxSize().background(Fs.Background).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SectionTitle("New Post")
        Text("Share a success or impact story from the field. Everyone in FieldSight sees it, and it can be shared as a link.", style = FsText.Label)

        Text("Photos (${photos.size}/${FeedRules.MAX_PHOTOS})*", color = Fs.Leaf, fontWeight = FontWeight.Medium, fontSize = 15.sp)
        if (photos.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                itemsIndexed(photos, key = { _, p -> p }) { i, path ->
                    Box {
                        RemoteImage(path, Modifier.size(110.dp).clip(FsShape.Tile), maxSide = 400)
                        Box(
                            Modifier.align(Alignment.TopEnd).padding(4.dp).size(28.dp).clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.55f))
                                .clickable { File(path).delete(); photos.removeAt(i) },
                            contentAlignment = Alignment.Center,
                        ) { Icon(AppIcons.Close, "Remove photo", tint = Color.White, modifier = Modifier.size(16.dp)) }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TonalButton("Camera", {
                val target = Photos.newCameraTarget(context)
                cameraTarget = target
                camera.launch(target.second)
            }, icon = AppIcons.Camera, enabled = !busy && photos.size < FeedRules.MAX_PHOTOS)
            TonalButton("Gallery", {
                gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }, icon = AppIcons.Feed, enabled = !busy && photos.size < FeedRules.MAX_PHOTOS)
        }
        if (busy) Text("Preparing photos...", style = FsText.Label)

        FsTextField(
            "Caption", caption, { caption = it.take(FeedRules.MAX_CAPTION) },
            singleLine = false, minLines = 4, placeholder = "What happened? Who did it help? What changed?",
        )
        SelectField(
            "Village (optional)",
            villages.firstOrNull { it.id == villageId }?.let { listOfNotNull(it.name, it.districtName).joinToString(", ") }.orEmpty(),
            { pickingVillage = true },
        )

        error?.let { ErrorText(it) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CreateButton("Post", {
                error = vm.saveFeedPost(FeedDraft(clientId, caption, villageId, photos.toList(), System.currentTimeMillis()))
            }, enabled = !busy)
            DangerButton("Cancel", {
                photos.forEach { File(it).delete() }
                vm.back()
            })
        }
        Spacer(Modifier.height(24.dp))
    }

    if (pickingVillage) {
        SearchPicker(
            title = "Village",
            options = villages.map { PickOption(it.id, it.name, listOfNotNull(it.districtName, it.stateName).joinToString(", ")) },
            selected = setOfNotNull(villageId),
            multi = false,
            onDismiss = { pickingVillage = false },
            onDone = { villageId = it.firstOrNull(); pickingVillage = false },
        )
    }
}
