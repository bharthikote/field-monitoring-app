package com.fieldmonitoring.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.fieldmonitoring.app.BuildConfig
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.ConfirmDialog
import com.fieldmonitoring.app.ui.components.DangerButton
import com.fieldmonitoring.app.ui.components.DetailGrid
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.PrimaryButton
import com.fieldmonitoring.app.ui.components.SectionTitle
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsText

@Composable
fun ProfileScreen(vm: AppViewModel) {
    val status by vm.status.collectAsState()
    val user = vm.user
    var confirmLogout by remember { mutableStateOf(false) }
    var unsentLogout by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().background(Fs.Background).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionTitle("Profile")
        FsCard {
            DetailGrid(
                listOf(
                    "Name" to (user?.name ?: ""),
                    "Role" to Format.role(user?.role ?: ""),
                    "User code" to (user?.userCode ?: ""),
                    "Mobile" to (user?.mobileNumber ?: ""),
                    "Email" to (user?.email ?: ""),
                ),
                columns = 2,
            )
        }
        FsCard {
            Text("Sync", color = Fs.Primary, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
            DetailGrid(
                listOf(
                    "Waiting to send" to status.pending.toString(),
                    "Needs attention" to status.attention.toString(),
                    "Last sync" to Format.ago(status.lastSyncAt),
                    "Villages" to vm.bundle.villages.size.toString(),
                    "Farmers" to vm.bundle.farmers.size.toString(),
                    "Plots" to vm.bundle.demoPlots.size.toString(),
                ),
            )
            status.lastError?.let { Text(it, color = Fs.Danger, modifier = Modifier.padding(top = 8.dp)) }
            Row(Modifier.padding(top = 12.dp)) {
                PrimaryButton(if (status.syncing) "Syncing..." else "Sync now", { vm.sync() }, enabled = !status.syncing, icon = AppIcons.Sync)
            }
        }
        DangerButton("Log Out", { confirmLogout = true })
        Text("FieldSight ${BuildConfig.VERSION_NAME}", style = FsText.Label)
    }

    if (confirmLogout) {
        ConfirmDialog(
            title = "Log out?",
            message = "You will need internet to log in again.",
            confirmText = "Log Out",
            destructive = true,
            onDismiss = { confirmLogout = false },
            onConfirm = {
                confirmLogout = false
                if (!vm.logout(force = false)) unsentLogout = true
            },
        )
    }
    if (unsentLogout) {
        ConfirmDialog(
            title = "Unsent work",
            message = "Some of your work (visits or issue actions) hasn't been sent yet. Logging out deletes it from this phone. Sync first if you can.",
            confirmText = "Delete and log out",
            destructive = true,
            onDismiss = { unsentLogout = false },
            onConfirm = {
                unsentLogout = false
                vm.logout(force = true)
            },
        )
    }
}
