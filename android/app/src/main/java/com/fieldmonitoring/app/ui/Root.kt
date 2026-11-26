package com.fieldmonitoring.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.BottomBar
import com.fieldmonitoring.app.ui.components.BottomTab
import com.fieldmonitoring.app.ui.components.TopBar
import com.fieldmonitoring.app.ui.screens.IssueDetailScreen
import com.fieldmonitoring.app.ui.screens.IssuesScreen
import com.fieldmonitoring.app.ui.screens.MessagesScreen
import com.fieldmonitoring.app.ui.screens.AddFarmerScreen
import com.fieldmonitoring.app.ui.screens.FeedCommentsScreen
import com.fieldmonitoring.app.ui.screens.FeedScreen
import com.fieldmonitoring.app.ui.screens.NewPostScreen
import com.fieldmonitoring.app.ui.screens.AppDrawer
import com.fieldmonitoring.app.ui.screens.FarmerDetailScreen
import com.fieldmonitoring.app.ui.screens.FarmersScreen
import com.fieldmonitoring.app.ui.screens.HomeScreen
import com.fieldmonitoring.app.ui.screens.LogVisitScreen
import com.fieldmonitoring.app.ui.screens.LoginScreen
import com.fieldmonitoring.app.ui.screens.PlotDetailScreen
import com.fieldmonitoring.app.ui.screens.DemosScreen
import com.fieldmonitoring.app.ui.screens.ProfileScreen
import com.fieldmonitoring.app.ui.theme.Fs
import kotlinx.coroutines.launch

@Composable
fun FieldSightRoot(vm: AppViewModel = viewModel()) {
    val status by vm.status.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(it)
            vm.message = null
        }
    }
    BackHandler(enabled = drawer.isOpen || vm.canGoBack) {
        if (drawer.isOpen) scope.launch { drawer.close() } else vm.back()
    }

    val screen = vm.screen
    if (screen is Screen.Login) {
        Box(Modifier.fillMaxSize()) {
            LoginScreen(vm)
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).navigationBarsPadding())
        }
        return
    }

    ModalNavigationDrawer(
        drawerState = drawer,
        gesturesEnabled = screen is Screen.Home,
        drawerContent = {
            AppDrawer(
                vm = vm,
                close = { scope.launch { drawer.close() } },
            )
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                TopBar(
                    onBack = if (vm.canGoBack) vm::back else null,
                    onMenu = if (screen is Screen.Home) ({ scope.launch { drawer.open() } }) else null,
                    pending = status.pending,
                    attention = status.attention,
                    syncing = status.syncing,
                    onSync = { vm.sync() },
                    // Messages only at the top of the Feed (decision 2026-11-23).
                    onMessages = if (screen is Screen.Feed) ({ vm.open(Screen.Messages) }) else null,
                )
                Box(Modifier.weight(1f)) {
                    when (screen) {
                        Screen.Home -> HomeScreen(vm)
                        Screen.Farmers -> FarmersScreen(vm)
                        is Screen.FarmerDetail -> FarmerDetailScreen(vm, screen.farmerId)
                        Screen.Demos -> DemosScreen(vm)
                        is Screen.PlotDetail -> PlotDetailScreen(vm, screen.plotId)
                        is Screen.LogVisit -> LogVisitScreen(vm, screen.plotId)
                        Screen.Profile -> ProfileScreen(vm)
                        Screen.Issues -> IssuesScreen(vm)
                        is Screen.IssueDetail -> IssueDetailScreen(vm, screen.issueId)
                        Screen.Messages -> MessagesScreen()
                        Screen.AddFarmer -> AddFarmerScreen(vm)
                        Screen.Feed -> FeedScreen(vm)
                        Screen.NewPost -> NewPostScreen(vm)
                        is Screen.FeedComments -> FeedCommentsScreen(vm, screen.postId)
                        Screen.Login -> Unit
                    }
                }
                if (vm.showBottomBar) {
                    BottomBar(
                        tabs = listOf(
                            BottomTab("Home", AppIcons.Home),
                            BottomTab("Feed", AppIcons.Feed),
                            BottomTab("Farmers", AppIcons.Group),
                            BottomTab("Issues", AppIcons.Issue, vm.issuesBadge),
                            BottomTab("Profile", AppIcons.Person),
                        ),
                        selected = TabScreens.indexOf(screen),
                        onSelect = { vm.selectTab(TabScreens[it]) },
                    )
                }
            }
            SnackbarHost(
                snackbar,
                Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = if (vm.showBottomBar) 72.dp else 0.dp),
            ) { data ->
                Snackbar(
                    modifier = Modifier.padding(12.dp),
                    containerColor = Fs.OnSurface,
                    contentColor = Color.White,
                ) { Text(data.visuals.message) }
            }
        }
    }
}
