package com.fieldmonitoring.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.fieldmonitoring.app.FieldSightApp
import com.fieldmonitoring.app.data.ApiException
import com.fieldmonitoring.app.data.Bundle
import com.fieldmonitoring.app.data.Issue
import com.fieldmonitoring.app.data.IssueAction
import com.fieldmonitoring.app.data.Repository
import com.fieldmonitoring.app.data.SyncWorker
import com.fieldmonitoring.app.data.User
import com.fieldmonitoring.app.data.VisitDraft
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Login : Screen
    data object Home : Screen
    data object Farmers : Screen
    data class FarmerDetail(val farmerId: String) : Screen
    data object Demos : Screen
    data class PlotDetail(val plotId: String) : Screen
    data class LogVisit(val plotId: String) : Screen
    data object Profile : Screen
    data object Issues : Screen
    data class IssueDetail(val issueId: String) : Screen
    data object Messages : Screen
}

/** The five screens on the bottom bar, in order. */
val TabScreens: List<Screen> = listOf(Screen.Home, Screen.Issues, Screen.Farmers, Screen.Messages, Screen.Profile)

/**
 * App state and navigation (a simple back stack - no navigation library, as
 * in the TVM app). Screens read the downloaded bundle through [bundle] and
 * recompose when [dataVersion] changes after a sync.
 */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    val repo: Repository = (app as FieldSightApp).repository
    val status = repo.status

    private val stack = mutableStateListOf<Screen>(if (repo.session() != null) Screen.Home else Screen.Login)
    val screen: Screen get() = stack.last()
    val canGoBack: Boolean get() = stack.size > 1

    var user: User? by mutableStateOf(repo.session()?.user)
        private set
    var dataVersion by mutableIntStateOf(0)
        private set
    var message: String? by mutableStateOf(null)
    var loginBusy by mutableStateOf(false)
        private set
    var loginError: String? by mutableStateOf(null)
        private set

    val bundle: Bundle get() = dataVersion.let { repo.bundle() }

    init {
        // First open after an update, or the last download failed: fetch now.
        if (user != null) sync(quiet = true)
    }

    /** Issues waiting on this user: the red count on the Issues tab. */
    var issuesBadge by mutableIntStateOf(repo.cachedIssuesNeedingAction())
        private set

    fun open(screen: Screen) {
        stack.add(screen)
    }

    /** Bottom-bar tap: that tab becomes the root (Home stays underneath, so Back returns to it). */
    fun selectTab(tab: Screen) {
        stack.clear()
        stack.add(Screen.Home)
        if (tab != Screen.Home) stack.add(tab)
    }

    /** The bottom bar shows on the five tab screens only, as in the old app. */
    val showBottomBar: Boolean get() = screen in TabScreens

    fun refreshIssuesBadge() {
        viewModelScope.launch {
            issuesBadge = runCatching { repo.fetchIssuesNeedingAction() }.getOrElse { repo.cachedIssuesNeedingAction() }
        }
    }

    fun back() {
        if (stack.size > 1) stack.removeAt(stack.lastIndex)
    }

    private fun resetTo(screen: Screen) {
        stack.clear()
        stack.add(screen)
    }

    fun login(identifier: String, password: String) {
        if (identifier.isBlank() || password.isBlank()) {
            loginError = "Enter your mobile number or email, and your password"
            return
        }
        loginBusy = true
        loginError = null
        viewModelScope.launch {
            try {
                user = repo.login(identifier, password)
                resetTo(Screen.Home)
                message = "Downloading your villages, farmers and plots..."
                sync(quiet = false)
            } catch (e: ApiException) {
                loginError = if (e.offline) "Logging in needs internet. Connect and try again." else e.message
            } finally {
                loginBusy = false
            }
        }
    }

    fun sync(quiet: Boolean = false) {
        viewModelScope.launch {
            val result = repo.syncNow()
            issuesBadge = repo.cachedIssuesNeedingAction()
            dataVersion++
            if (!quiet || result.lastError != null) {
                message = result.lastError ?: when {
                    result.attention > 0 -> "Synced. ${result.attention} record(s) need your attention."
                    else -> "Everything is synced"
                }
            }
            if (result.lastError?.contains("login") == true) user = repo.session()?.user
        }
    }

    /** Saves the visit on the phone. Returns an error to show, or null when saved. */
    fun saveVisit(draft: VisitDraft): String? {
        val error = repo.saveVisit(draft)
        if (error != null) return error
        SyncWorker.soon(getApplication())
        dataVersion++
        message = "Visit saved on this phone. It will be sent when there is a connection."
        back()
        return null
    }

    /** Saves an issue action for the next sync (works offline). Returns an error, or null. */
    fun saveIssueAction(issue: Issue, action: IssueAction, note: String): String? {
        val error = repo.saveIssueAction(issue, action, note, java.util.UUID.randomUUID().toString())
        if (error != null) return error
        SyncWorker.soon(getApplication())
        dataVersion++
        message = "${action.label}: saved. It will be sent when there is a connection."
        sync(quiet = true)
        return null
    }

    /** Assign / Reassign: straight to the server. [done] gets an error, or null on success. */
    fun sendIssueActionNow(issue: Issue, action: IssueAction, note: String, assignedTo: String, done: (String?) -> Unit) {
        viewModelScope.launch {
            val error = try {
                repo.sendIssueActionNow(issue, action, note, assignedTo)
                repo.fetchIssues("assigned")
                repo.fetchIssues("raised")
                null
            } catch (e: ApiException) {
                if (e.offline) "${action.label} needs a connection. Try again when you have signal." else e.message
            }
            if (error == null) {
                message = "${action.label}: done"
                dataVersion++
                refreshIssuesBadge()
            }
            done(error)
        }
    }

    fun retryRecord(id: String) {
        repo.retryRecord(id)
        dataVersion++
        sync(quiet = true)
    }

    fun discardRecord(id: String) {
        repo.discardRecord(id)
        dataVersion++
    }

    /** False when unsent work blocks logging out (the screen then asks). */
    fun logout(force: Boolean): Boolean {
        if (!repo.logout(force)) return false
        user = null
        dataVersion++
        resetTo(Screen.Login)
        return true
    }
}
