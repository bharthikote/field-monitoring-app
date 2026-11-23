package com.fieldmonitoring.app.ui.screens

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.data.ApiException
import com.fieldmonitoring.app.data.HistoryVisit
import com.fieldmonitoring.app.data.RecordState
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.ConfirmDialog
import com.fieldmonitoring.app.ui.components.CreateButton
import com.fieldmonitoring.app.ui.components.DangerChip
import com.fieldmonitoring.app.ui.components.DetailGrid
import com.fieldmonitoring.app.ui.components.DotTabs
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.PillKind
import com.fieldmonitoring.app.ui.components.StatusPill
import com.fieldmonitoring.app.ui.components.TonalChip
import com.fieldmonitoring.app.ui.components.plotStatusPill
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText
import java.io.File

/** Plot summary card (KT style) with tabs: Visits (log + history), Plot details. */
@Composable
fun PlotDetailScreen(vm: AppViewModel, plotId: String) {
    val plot = vm.bundle.demoPlots.firstOrNull { it.id == plotId }
    if (plot == null) {
        EmptyState("This plot is no longer in your downloaded data.")
        return
    }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var refreshNote by remember { mutableStateOf<String?>(null) }
    var historyVersion by remember { mutableIntStateOf(0) }

    // Fresh history when online; otherwise the last copy saved on the phone.
    LaunchedEffect(plotId, vm.dataVersion) {
        refreshNote = try {
            vm.repo.fetchVisits(plotId)
            historyVersion++
            null
        } catch (e: ApiException) {
            if (e.offline) "Offline - showing the history saved on this phone" else e.message
        } catch (e: Exception) {
            "Couldn't refresh the visit history"
        }
    }
    val history = remember(plotId, vm.dataVersion, historyVersion) { vm.repo.visitHistory(plotId) }
    val openIssues = vm.bundle.openIssues.filter { it.demoPlotId == plotId }

    Column(Modifier.fillMaxSize().background(Fs.Background).verticalScroll(rememberScrollState())) {
        Box(Modifier.padding(16.dp)) {
            FsCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Demo",
                        color = Fs.Leaf,
                        fontSize = 18.sp,
                        modifier = Modifier.weight(1f),
                    )
                    TonalChip(plot.cropName) {}
                }
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(plot.farmerName, color = Fs.Primary, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    val (label, kind) = plotStatusPill(plot.status)
                    StatusPill(label, kind)
                }
                Spacer(Modifier.height(14.dp))
                DetailGrid(
                    listOf(
                        "Visits" to history.size.toString(),
                        "Open issues" to openIssues.size.toString(),
                        "Unsent" to history.count { it.localState != null && it.localState != RecordState.SENT }.toString(),
                        "Demo Type" to plot.demoTypeLabel,
                        "Variety" to plot.varietyName,
                        "Village" to (plot.villageName ?: ""),
                    ),
                    columns = 3,
                )
            }
        }

        DotTabs(listOf("Visits", "Plot"), tab, { tab = it })

        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (tab == 0) {
                CreateButton("Log Visit", { vm.open(Screen.LogVisit(plotId)) }, icon = AppIcons.Camera)
                refreshNote?.let { Text(it, style = FsText.Label) }
                if (history.isEmpty()) EmptyState("No visits logged on this plot yet.")
                history.forEach { visit -> VisitCard(vm, visit) }
            } else {
                FsCard {
                    DetailGrid(
                        listOf(
                            "Demo Type" to plot.demoTypeLabel,
                            "Crop" to plot.cropName,
                            "Variety" to plot.varietyName,
                            "Cycle" to Format.label(plot.cycle).takeIf { plot.cycle != null }.orEmpty(),
                            "Village" to (plot.villageName ?: ""),
                            "District" to (plot.districtName ?: ""),
                            "Phone" to plot.farmerPhone,
                            "Created" to Format.date(plot.createdAt),
                            "GPS" to if (plot.gpsLat != null) "Recorded" else "Not recorded",
                            "Status" to Format.label(plot.status),
                        ),
                    )
                }
                if (openIssues.isNotEmpty()) {
                    Text("Open issues", color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    openIssues.forEach { issue ->
                        FsCard {
                            Text(issue.issueTypeName, color = Fs.OnSurface, fontWeight = FontWeight.Bold)
                            Text(
                                "${Format.label(issue.status)}${issue.holderName?.let { " - with $it" } ?: ""}",
                                style = FsText.Label,
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun VisitCard(vm: AppViewModel, visit: HistoryVisit) {
    var confirmDiscard by remember { mutableStateOf(false) }
    FsCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(Format.dateTime(visit.createdAt), color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                visit.visitedBy?.let { Text(it, style = FsText.Label) }
            }
            when (visit.localState) {
                RecordState.PENDING -> StatusPill("Pending sync", PillKind.Pending)
                RecordState.ATTENTION -> StatusPill("Needs attention", PillKind.Attention)
                RecordState.SENT -> StatusPill("Sent", PillKind.Neutral)
                else -> Unit
            }
        }
        visit.localPhoto?.let { path ->
            val bitmap = remember(path) {
                File(path).takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path, BitmapFactory.Options().apply { inSampleSize = 4 }) }
            }
            if (bitmap != null) {
                Spacer(Modifier.height(10.dp))
                Image(
                    bitmap.asImageBitmap(),
                    contentDescription = "Visit photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(160.dp).clip(FsShape.Control),
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Text("Action plan", style = FsText.Label)
        Text(visit.actionPlan, color = Fs.OnSurface, fontSize = 15.sp)
        Spacer(Modifier.height(6.dp))
        Text("Comments", style = FsText.Label)
        Text(visit.comments, color = Fs.OnSurface, fontSize = 15.sp)
        listOf(
            "Issues" to visit.issues,
            "Good things" to visit.goodThings,
            "Diseases" to visit.diseases,
            "Pests" to visit.pests,
        ).filter { it.second.isNotEmpty() }.forEach { (label, names) ->
            Spacer(Modifier.height(6.dp))
            Text(label, style = FsText.Label)
            Text(names.joinToString(", "), color = Fs.OnSurface, fontSize = 15.sp)
        }
        if (visit.localState == RecordState.ATTENTION && visit.recordId != null) {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.material3.Icon(AppIcons.Warning, null, tint = Fs.Danger, modifier = Modifier.size(18.dp))
                Text(visit.error ?: "The server refused this visit", color = Fs.Danger, fontSize = 14.sp, modifier = Modifier.padding(start = 6.dp))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TonalChip("Try again") { vm.retryRecord(visit.recordId) }
                DangerChip("Discard") { confirmDiscard = true }
            }
        }
    }
    if (confirmDiscard && visit.recordId != null) {
        ConfirmDialog(
            title = "Discard this visit?",
            message = "It will be deleted from this phone and never sent.",
            confirmText = "Discard",
            destructive = true,
            onDismiss = { confirmDiscard = false },
            onConfirm = {
                confirmDiscard = false
                vm.discardRecord(visit.recordId)
            },
        )
    }
}
