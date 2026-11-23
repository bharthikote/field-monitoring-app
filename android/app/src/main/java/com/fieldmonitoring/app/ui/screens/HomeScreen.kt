package com.fieldmonitoring.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.TabScreens
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.ConfirmDialog
import com.fieldmonitoring.app.ui.components.FieldSightLogo
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText

private data class Tile(
    val title: String,
    val icon: ImageVector,
    val container: Color,
    val content: Color,
    val count: Int?,
    val countLabel: String,
    val target: Screen?,
)

@Composable
private fun tiles(vm: AppViewModel): List<Tile> {
    val b = vm.bundle
    return listOf(
        Tile("Farmers", AppIcons.Group, Fs.PrimaryContainer, Fs.Primary, b.farmers.size, "farmers", Screen.Farmers),
        Tile("Demos", AppIcons.Leaf, Fs.LeafContainer, Fs.Leaf, b.demoPlots.size, "demos", Screen.Demos),
        Tile("Trainings", AppIcons.Event, Fs.AccentContainer, Fs.Accent, null, "Coming in the next update", null),
        Tile("Field Days", AppIcons.Event, Fs.AccentContainer, Fs.Accent, null, "Coming in the next update", null),
    )
}

/** Dashboard: greeting, sync summary, and a count card per module. */
@Composable
fun HomeScreen(vm: AppViewModel) {
    val status by vm.status.collectAsState()
    val user = vm.user
    Column(
        Modifier
            .fillMaxSize()
            .background(Fs.Background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        FsCard {
            Text("Hello, ${user?.name ?: ""}", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall)
            Text(Format.role(user?.role ?: ""), style = FsText.Label)
            Spacer(Modifier.height(10.dp))
            val waiting = status.pending + status.attention
            Text(
                when {
                    status.syncing -> "Syncing..."
                    waiting == 0 -> "Everything is synced (${Format.ago(status.lastSyncAt)})"
                    else -> "$waiting record(s) waiting to be sent"
                },
                color = if (waiting == 0) Fs.Leaf else Fs.Accent,
                fontWeight = FontWeight.Bold,
            )
            if (!vm.repo.hasBundle()) {
                Text("Connect to the internet once to download your villages and farmers.", style = FsText.Label)
            }
        }
        tiles(vm).chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                row.forEach { tile ->
                    CountCard(tile, Modifier.weight(1f)) {
                        tile.target?.let { if (it in TabScreens) vm.selectTab(it) else vm.open(it) }
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun CountCard(tile: Tile, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(FsShape.Tile)
            .background(tile.container)
            .clickable(enabled = tile.target != null, onClick = onClick)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(tile.title, color = tile.content, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
            Icon(tile.icon, null, tint = tile.content, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(10.dp))
        if (tile.count != null) {
            Text(tile.count.toString(), color = tile.content, fontWeight = FontWeight.Bold, fontSize = 34.sp)
        }
        Text(tile.countLabel, color = tile.content, fontSize = 13.sp)
    }
}

/** Side menu: module tiles tinted by group, footer with Profile, Sync, Log Out (skill section 2). */
@Composable
fun AppDrawer(vm: AppViewModel, close: () -> Unit) {
    var confirmLogout by remember { mutableStateOf(false) }
    var unsentLogout by remember { mutableStateOf(false) }

    ModalDrawerSheet(drawerContainerColor = Fs.Surface, drawerShape = FsShape.Card) {
        Column(Modifier.fillMaxHeight().statusBarsPadding().navigationBarsPadding().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(close) { Icon(AppIcons.Close, "Close menu", tint = Fs.OnSurface) }
                Spacer(Modifier.weight(1f))
                FieldSightLogo(markSize = 26.dp, textSize = 18.sp)
            }
            Spacer(Modifier.height(12.dp))
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                tiles(vm).forEach { tile ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(72.dp)
                            .clip(FsShape.Tile)
                            .background(tile.container)
                            .clickable(enabled = tile.target != null) {
                                tile.target?.let { if (it in TabScreens) vm.selectTab(it) else vm.open(it) }
                                close()
                            }
                            .padding(horizontal = 18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(tile.title, color = tile.content, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            if (tile.target == null) Text(tile.countLabel, color = tile.content, fontSize = 12.sp)
                        }
                        Icon(tile.icon, null, tint = tile.content, modifier = Modifier.size(30.dp))
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                FooterAction("Profile", AppIcons.Person, Fs.OnSurface, Color.Transparent) { vm.selectTab(Screen.Profile); close() }
                FooterAction("Sync", AppIcons.Sync, Fs.OnSurface, Color.Transparent) { vm.sync(); close() }
                FooterAction("Log Out", AppIcons.Logout, Fs.Danger, Fs.DangerContainer) { confirmLogout = true }
            }
        }
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
            message = "Some visits haven't been sent yet. Logging out deletes them from this phone. Sync first if you can.",
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

@Composable
private fun FooterAction(label: String, icon: ImageVector, color: Color, background: Color, onClick: () -> Unit) {
    Column(
        Modifier
            .clip(FsShape.Tile)
            .background(background)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, tint = color)
        Spacer(Modifier.width(4.dp))
        Text(label, color = color, fontSize = 14.sp)
    }
}

@Composable
internal fun ScreenColumn(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(Fs.Background)) { content() }
}
