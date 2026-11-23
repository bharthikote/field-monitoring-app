package com.fieldmonitoring.app.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import com.fieldmonitoring.app.data.FarmerRules
import com.fieldmonitoring.app.data.RecordState
import com.fieldmonitoring.app.ui.components.ConfirmDialog
import com.fieldmonitoring.app.ui.components.DangerChip
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.PillKind
import com.fieldmonitoring.app.ui.components.StatusPill
import com.fieldmonitoring.app.ui.components.TonalChip
import com.fieldmonitoring.app.ui.theme.FsText
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.DetailGrid
import com.fieldmonitoring.app.ui.components.DotTabs
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape

/** Farmer profile card (KT style) with tabs: Plots, Details. */
@Composable
fun FarmerDetailScreen(vm: AppViewModel, farmerId: String) {
    val farmer = vm.farmers.firstOrNull { it.id == farmerId }
    if (farmer == null) {
        EmptyState(
            if (farmerId.startsWith(FarmerRules.LOCAL_PREFIX)) "This farmer has been sent to the server. Open them again from the Farmers list."
            else "This farmer is no longer in your downloaded data.",
        )
        return
    }
    val plots = vm.bundle.demoPlots.filter { it.farmerId == farmer.id || it.farmerPhone == farmer.phone }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val localRecord = remember(farmerId, vm.dataVersion) { vm.repo.localFarmerRecord(farmerId) }
    var confirmDiscard by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Fs.Background).verticalScroll(rememberScrollState())) {
        if (localRecord != null) {
            Box(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp)) {
                FsCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Registered on this phone", color = Fs.Primary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        if (localRecord.state == RecordState.ATTENTION) StatusPill("Needs attention", PillKind.Attention)
                        else StatusPill("Pending sync", PillKind.Pending)
                    }
                    if (localRecord.state == RecordState.ATTENTION) {
                        Text(localRecord.error ?: "The server refused this farmer", color = Fs.Danger, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 10.dp)) {
                            TonalChip("Try again") { vm.retryRecord(localRecord.id) }
                            DangerChip("Discard") { confirmDiscard = true }
                        }
                    } else {
                        Text("It will be sent when there is a connection, and gets its Farmer ID then.", style = FsText.Label)
                    }
                }
            }
        }
        Box(Modifier.padding(16.dp)) {
            Card(
                shape = FsShape.Card,
                colors = CardDefaults.cardColors(containerColor = Fs.Surface),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.fillMaxWidth().background(Fs.LeafContainer).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("FARMER", color = Fs.Primary, fontWeight = FontWeight.Medium, fontSize = 15.sp)
                    Spacer(Modifier.width(8.dp))
                    Text(farmer.phone, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(88.dp).clip(FsShape.Tile).background(Fs.Field),
                        contentAlignment = Alignment.Center,
                    ) { Icon(AppIcons.Person, null, tint = Fs.LabelMuted, modifier = Modifier.size(56.dp)) }
                    Column(Modifier.padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(farmer.name, color = Fs.Primary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        farmer.farmerType?.let {
                            Text(Format.label(it), color = Fs.OnSurface, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                        val ageGender = listOfNotNull(
                            Format.gender(farmer.gender).ifBlank { null },
                            farmer.age?.toString(),
                        ).joinToString(", ")
                        Text(
                            listOf(ageGender, farmer.phone).filter { it.isNotBlank() }.joinToString(" | "),
                            color = Fs.Leaf,
                            fontSize = 15.sp,
                        )
                    }
                }
            }
        }

        DotTabs(listOf("Demos", "Details"), tab, { tab = it })

        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (tab == 0) {
                if (plots.isEmpty()) EmptyState("No demos for this farmer yet.")
                plots.forEach { plot -> PlotRow(plot) { vm.open(Screen.PlotDetail(plot.id)) } }
            } else {
                Card(
                    shape = FsShape.Card,
                    colors = CardDefaults.cardColors(containerColor = Fs.Surface),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        DetailGrid(
                            listOf(
                                "Village" to (farmer.villageName ?: ""),
                                "District" to (farmer.districtName ?: ""),
                                "State" to (farmer.stateName ?: ""),
                                "Birth date" to Format.date(farmer.birthDate).takeIf { farmer.birthDate != null }.orEmpty(),
                                "Education" to Format.label(farmer.educationLevel).takeIf { farmer.educationLevel != null }.orEmpty(),
                                "Literacy" to Format.label(farmer.literacy).takeIf { farmer.literacy != null }.orEmpty(),
                                "Phone type" to Format.label(farmer.phoneType).takeIf { farmer.phoneType != null }.orEmpty(),
                                "Email" to (farmer.email ?: ""),
                                "Address" to (farmer.address ?: ""),
                            ),
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
    if (confirmDiscard && localRecord != null) {
        ConfirmDialog(
            title = "Discard this farmer?",
            message = "${farmer.name} will be deleted from this phone and never sent.",
            confirmText = "Discard",
            destructive = true,
            onDismiss = { confirmDiscard = false },
            onConfirm = {
                confirmDiscard = false
                vm.discardRecord(localRecord.id)
                vm.back()
            },
        )
    }
}
