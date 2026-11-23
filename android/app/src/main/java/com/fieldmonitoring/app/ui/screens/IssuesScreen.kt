package com.fieldmonitoring.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.window.Dialog
import com.fieldmonitoring.app.data.ApiException
import com.fieldmonitoring.app.data.AssignableUser
import com.fieldmonitoring.app.data.Issue
import com.fieldmonitoring.app.data.IssueAction
import com.fieldmonitoring.app.data.NoteRule
import com.fieldmonitoring.app.data.RecordState
import com.fieldmonitoring.app.ui.components.DangerButton
import com.fieldmonitoring.app.ui.components.DangerChip
import com.fieldmonitoring.app.ui.components.ErrorText
import com.fieldmonitoring.app.ui.components.FsTextField
import com.fieldmonitoring.app.ui.components.PickOption
import com.fieldmonitoring.app.ui.components.SearchPicker
import com.fieldmonitoring.app.ui.components.SelectField
import com.fieldmonitoring.app.ui.components.TonalButton
import com.fieldmonitoring.app.ui.components.TonalChip
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.DetailGrid
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.PillKind
import com.fieldmonitoring.app.ui.components.PrimaryButton
import com.fieldmonitoring.app.ui.components.SectionTitle
import com.fieldmonitoring.app.ui.components.Segmented
import com.fieldmonitoring.app.ui.components.StatusPill
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsText

/** Status label and pill colour, same words as the web admin. */
fun issueStatus(status: String): Pair<String, PillKind> = when (status) {
    "raised" -> "Raised" to PillKind.Pending
    "assigned" -> "Assigned" to PillKind.Ongoing
    "in_progress" -> "In progress" to PillKind.Ongoing
    "pending_verification" -> "Pending verification" to PillKind.Neutral
    "disputed" -> "Disputed" to PillKind.Attention
    "closed" -> "Closed" to PillKind.Completed
    "dismissed" -> "Dismissed" to PillKind.Pending
    else -> Format.label(status) to PillKind.Neutral
}

/** Statuses where the person holding the issue has something to do. */
private val NEEDS_ACTION = setOf("assigned", "pending_verification", "disputed")

/**
 * Issues tab: the issues assigned to me and the ones I raised. Read from the
 * server when online; the last copy stays on the phone for offline viewing.
 */
@Composable
fun IssuesScreen(vm: AppViewModel) {
    var box by rememberSaveable { mutableIntStateOf(0) }
    val key = if (box == 0) "assigned" else "raised"
    var version by remember { mutableIntStateOf(0) }
    var note by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(key, vm.dataVersion) {
        note = try {
            vm.repo.fetchIssues(key)
            version++
            null
        } catch (e: ApiException) {
            if (e.offline) "Offline - showing the issues saved on this phone" else e.message
        } catch (e: Exception) {
            "Couldn't refresh the issues"
        }
        vm.refreshIssuesBadge()
    }
    val issues = remember(key, version, vm.dataVersion) { vm.repo.cachedIssues(key) }
    val me = vm.user?.id

    Column(Modifier.fillMaxSize().background(Fs.Background)) {
        Column(Modifier.padding(16.dp)) {
            SectionTitle("Issues")
            Spacer(Modifier.height(12.dp))
            Segmented(listOf("Assigned to me", "Raised by me"), box) { box = it }
            note?.let { Text(it, style = FsText.Label, modifier = Modifier.padding(top = 8.dp)) }
        }
        if (issues.isEmpty()) {
            EmptyState(if (box == 0) "Nothing is assigned to you right now." else "You haven't raised any issues.")
        }
        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(issues, key = { it.id }) { issue ->
                IssueRow(issue, needsMe = box == 0 && issue.status in NEEDS_ACTION && issue.assignedToId == me) {
                    vm.open(Screen.IssueDetail(issue.id))
                }
            }
        }
    }
}

@Composable
private fun IssueRow(issue: Issue, needsMe: Boolean, onClick: () -> Unit) {
    FsCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(issue.issueTypeName, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.weight(1f))
            val (label, kind) = issueStatus(issue.status)
            StatusPill(label, kind)
        }
        if (needsMe) {
            Text("Needs your action", color = Fs.Danger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
        Spacer(Modifier.height(10.dp))
        DetailGrid(
            listOf(
                "Farmer" to (issue.farmerName ?: ""),
                "Village" to (issue.villageName ?: ""),
                "Raised" to Format.date(issue.createdAt),
                "Raised by" to (issue.raisedByName ?: ""),
                "With" to (issue.assignedToName ?: "Unassigned"),
                "Type" to if (issue.acknowledgeOnly) "Acknowledge" else "Resolve",
            ),
        )
    }
}

/** One issue, read-only for now; the actions (start, resolve, verify...) come next. */
@Composable
fun IssueDetailScreen(vm: AppViewModel, issueId: String) {
    val issue = vm.repo.cachedIssue(issueId)
    if (issue == null) {
        EmptyState("This issue isn't saved on this phone. Open the Issues tab while online to refresh.")
        return
    }
    val plotOnPhone = vm.bundle.demoPlots.any { it.id == issue.demoPlotId }
    Column(
        Modifier.fillMaxSize().background(Fs.Background).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        FsCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Issue", color = Fs.Leaf, fontSize = 18.sp, modifier = Modifier.weight(1f))
                val (label, kind) = issueStatus(issue.status)
                StatusPill(label, kind)
            }
            Text(issue.issueTypeName, color = Fs.Primary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            DetailGrid(
                listOf(
                    "Farmer" to (issue.farmerName ?: ""),
                    "Phone" to (issue.farmerPhone ?: ""),
                    "Village" to (issue.villageName ?: ""),
                    "Raised by" to (issue.raisedByName ?: ""),
                    "Raised" to Format.dateTime(issue.createdAt),
                    "With" to (issue.assignedToName ?: "Unassigned"),
                    "Resolved by" to (issue.resolvedByName ?: ""),
                    "Closed" to if (issue.closedAt != null) Format.dateTime(issue.closedAt) else "",
                    "Reopened" to issue.reopenedCount.toString(),
                ),
            )
        }
        listOf(
            "Resolution note" to issue.resolutionNote,
            "Rejection note" to issue.rejectionNote,
            "Dispute note" to issue.disputeNote,
            "Dismissal note" to issue.dismissalNote,
        ).filter { !it.second.isNullOrBlank() }.forEach { (label, text) ->
            FsCard {
                Text(label, style = FsText.Label)
                Text(text!!, color = Fs.OnSurface, fontSize = 15.sp)
            }
        }
        IssueActionsCard(vm, issue)
        if (plotOnPhone) {
            TonalButton("Open demo", { vm.open(Screen.PlotDetail(issue.demoPlotId)) }, icon = AppIcons.Leaf)
        }
    }
}

/**
 * The actions open to me on this issue (same rules as the server). Most are
 * saved on the phone and sent with the next sync; Assign and Reassign need a
 * connection to fetch who the issue can go to.
 */
@Composable
private fun IssueActionsCard(vm: AppViewModel, issue: Issue) {
    val pending = remember(issue.id, vm.dataVersion) { vm.repo.pendingIssueAction(issue.id) }
    val actions = IssueAction.available(issue, vm.user?.id)
    var chosen by remember { mutableStateOf<IssueAction?>(null) }

    if (pending != null) {
        val (record, draft) = pending
        FsCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(draft.issueAction?.label ?: "Action", color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
                if (record.state == RecordState.ATTENTION) StatusPill("Needs attention", PillKind.Attention)
                else StatusPill("Pending sync", PillKind.Pending)
            }
            if (record.state == RecordState.ATTENTION) {
                Text(record.error ?: "The server refused this action", color = Fs.Danger, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 10.dp)) {
                    TonalChip("Try again") { vm.retryRecord(record.id) }
                    DangerChip("Discard") { vm.discardRecord(record.id) }
                }
            } else {
                Text("Saved on this phone. It will be sent when there is a connection.", style = FsText.Label)
            }
        }
        return
    }
    if (actions.isEmpty()) {
        Text(
            if (issue.assignedToId == vm.user?.id) "Nothing to do on this issue right now." else "This issue is with ${issue.assignedToName ?: "nobody yet"}.",
            style = FsText.Label,
        )
        return
    }
    FsCard {
        Text("What would you like to do?", color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            actions.forEach { action ->
                when {
                    action.destructive -> DangerButton(action.label, { chosen = action }, Modifier.fillMaxWidth())
                    action == actions.first() -> PrimaryButton(action.label, { chosen = action }, Modifier.fillMaxWidth())
                    else -> TonalButton(action.label, { chosen = action }, Modifier.fillMaxWidth())
                }
            }
        }
    }
    chosen?.let { action ->
        if (action.offline) {
            ActionNoteDialog(action, onDismiss = { chosen = null }) { note ->
                vm.saveIssueAction(issue, action, note).also { if (it == null) chosen = null }
            }
        } else {
            AssignDialog(vm, issue, action, onDismiss = { chosen = null })
        }
    }
}

/** Confirms an action, asking for a note when the action takes one. Returns an error to show, or null when done. */
@Composable
private fun ActionNoteDialog(action: IssueAction, onDismiss: () -> Unit, onConfirm: (String) -> String?) {
    var note by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = FsShape.Dialog, color = Fs.Surface, modifier = Modifier.fillMaxWidth()) {
            Column {
                Box(
                    Modifier.fillMaxWidth().background(Fs.Primary).padding(vertical = 18.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(action.label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (action.note == NoteRule.None) {
                        Text("Mark this issue as started?", color = Fs.OnSurface, fontSize = 16.sp)
                    } else {
                        FsTextField(action.noteLabel, note, { note = it }, required = action.note == NoteRule.Required, singleLine = false, minLines = 3)
                    }
                    error?.let { ErrorText(it) }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        TonalButton("Cancel", onDismiss, Modifier.weight(1f))
                        val confirm = { error = onConfirm(note) }
                        if (action.destructive) DangerButton(action.label.substringBefore(" -"), confirm, Modifier.weight(1f))
                        else PrimaryButton("Save", confirm, Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/** Assign / Reassign: pick a person (list from the server) and, for Reassign, say why. */
@Composable
private fun AssignDialog(vm: AppViewModel, issue: Issue, action: IssueAction, onDismiss: () -> Unit) {
    var users by remember { mutableStateOf<List<AssignableUser>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var picked by remember { mutableStateOf<AssignableUser?>(null) }
    var picking by remember { mutableStateOf(false) }
    var comment by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(issue.id, action) {
        try {
            users = vm.repo.assignableUsers(issue, action)
        } catch (e: ApiException) {
            error = if (e.offline) "${action.label} needs a connection to see who it can go to." else e.message
            users = emptyList()
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = FsShape.Dialog, color = Fs.Surface, modifier = Modifier.fillMaxWidth()) {
            Column {
                Box(
                    Modifier.fillMaxWidth().background(Fs.Primary).padding(vertical = 18.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(action.label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when {
                        users == null -> Text("Loading who this can go to...", style = FsText.Label)
                        users!!.isEmpty() && error == null -> Text("Nobody else covers this village for this issue.", style = FsText.Label)
                        users!!.isNotEmpty() -> SelectField(
                            "Give it to",
                            picked?.let { "${it.name}${it.role?.let { r -> " (${Format.role(r)})" } ?: ""}" }.orEmpty(),
                            { picking = true },
                            required = true,
                        )
                    }
                    if (action.note == NoteRule.Required) {
                        FsTextField(action.noteLabel, comment, { comment = it }, required = true, singleLine = false, minLines = 3)
                    }
                    error?.let { ErrorText(it) }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        TonalButton("Cancel", onDismiss, Modifier.weight(1f))
                        PrimaryButton(if (busy) "Sending..." else action.label, {
                            val target = picked
                            when {
                                target == null -> error = "Pick a person"
                                action.note == NoteRule.Required && comment.isBlank() -> error = "Please add a comment"
                                else -> {
                                    busy = true
                                    vm.sendIssueActionNow(issue, action, comment, target.id) { e ->
                                        busy = false
                                        if (e == null) onDismiss() else error = e
                                    }
                                }
                            }
                        }, Modifier.weight(1f), enabled = !busy && !users.isNullOrEmpty())
                    }
                }
            }
        }
    }
    if (picking) {
        SearchPicker(
            title = "Give it to",
            options = users.orEmpty().map { PickOption(it.id, it.name, it.role?.let(Format::role)) },
            selected = setOfNotNull(picked?.id),
            multi = false,
            onDismiss = { picking = false },
            onDone = { ids -> picked = users.orEmpty().firstOrNull { it.id in ids }; picking = false },
        )
    }
}

/** Messages tab - not built yet, as in the previous app. */
@Composable
fun MessagesScreen() {
    Box(Modifier.fillMaxSize().background(Fs.Background), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(24.dp)) {
            SectionTitle("Messages")
            Spacer(Modifier.height(8.dp))
            Text("Coming soon: messages with your team.", style = FsText.Label)
        }
    }
}
