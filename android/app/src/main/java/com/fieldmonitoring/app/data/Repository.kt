package com.fieldmonitoring.app.data

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.io.File

@Serializable
data class Session(val token: String, val user: User)

data class SyncStatus(
    val pending: Int = 0,
    val attention: Int = 0,
    val syncing: Boolean = false,
    val lastSyncAt: Long? = null,
    val lastError: String? = null,
)

/** A visit for the history list: either still on the phone or from the server. */
data class HistoryVisit(
    val key: String,
    val actionPlan: String,
    val comments: String,
    val createdAt: String,
    val visitedBy: String?,
    val issues: List<String>,
    val goodThings: List<String>,
    val diseases: List<String>,
    val pests: List<String>,
    val photoUrl: String?,
    val localPhoto: String?,
    /** null when the server has it; otherwise the outbox state. */
    val localState: String?,
    val error: String? = null,
    val recordId: String? = null,
)

/**
 * The one place the app reads and writes data. Screens never call the server
 * directly: they read the downloaded bundle, save into the outbox, and ask
 * for a sync. Everything here works without a connection except [login],
 * [syncNow] and [fetchVisits].
 */
class Repository(
    private val store: OutboxStore,
    private val remote: Remote,
    private val io: CoroutineDispatcher = Dispatchers.IO,
    private val now: () -> Long = System::currentTimeMillis,
    private val deleteFile: (String) -> Unit = { File(it).delete() },
) {
    private val syncLock = Mutex()
    private var cachedBundle: Bundle? = null
    private val _status = MutableStateFlow(SyncStatus())
    val status: StateFlow<SyncStatus> = _status.asStateFlow()

    init {
        refreshCounts()
    }

    // --- Session ---

    fun session(): Session? = store.getValue(KEY_SESSION)?.let {
        runCatching { AppJson.decodeFromString<Session>(it) }.getOrNull()
    }

    suspend fun login(identifier: String, password: String): User = withContext(io) {
        val body = AppJson.encodeToString(mapOf("identifier" to identifier.trim(), "password" to password))
        val response = AppJson.decodeFromString<LoginResponse>(remote.postJson("/auth/login", body))
        store.putValue(KEY_SESSION, AppJson.encodeToString(Session(response.token, response.user)))
        response.user
    }

    /** Logging out wipes the phone's copy, so it refuses while work is unsent unless [force]. */
    fun logout(force: Boolean): Boolean {
        val unsent = store.byState(RecordState.PENDING) + store.byState(RecordState.ATTENTION)
        if (unsent.isNotEmpty() && !force) return false
        for (record in store.all(RecordKind.VISIT) + store.all(RecordKind.FARMER)) deletePhotos(record)
        store.clearAll()
        cachedBundle = null
        refreshCounts()
        return true
    }

    // --- Downloaded data ---

    fun bundle(): Bundle {
        cachedBundle?.let { return it }
        val parsed = store.getValue(KEY_BUNDLE)?.let {
            runCatching { AppJson.decodeFromString<Bundle>(it) }.getOrNull()
        } ?: Bundle()
        cachedBundle = parsed
        return parsed
    }

    fun hasBundle() = store.getValue(KEY_BUNDLE) != null

    suspend fun downloadBundle(): Bundle = withContext(io) {
        val text = remote.get("/sync/bundle")
        val parsed = AppJson.decodeFromString<Bundle>(text)
        store.putValue(KEY_BUNDLE, text)
        cachedBundle = parsed
        parsed
    }

    // --- Visits ---

    /** Saves a visit on the phone. Returns an error message, or null when saved. */
    fun saveVisit(draft: VisitDraft): String? {
        VisitRules.validate(draft)?.let { return it }
        store.add(
            OutboxRecord(
                id = draft.clientId,
                kind = RecordKind.VISIT,
                body = AppJson.encodeToString(draft),
                state = RecordState.PENDING,
                createdAt = draft.createdAtMillis.takeIf { it > 0 } ?: now(),
            ),
        )
        refreshCounts()
        return null
    }

    suspend fun fetchVisits(plotId: String): List<ServerVisit> = withContext(io) {
        val text = remote.get("/visits?demo_plot_id=$plotId")
        store.putValue("$KEY_VISITS$plotId", text)
        AppJson.decodeFromString<VisitList>(text).visits
    }

    /** Visit history for a plot: unsent visits first, then the last copy from the server. */
    fun visitHistory(plotId: String): List<HistoryVisit> {
        val server = store.getValue("$KEY_VISITS$plotId")
            ?.let { runCatching { AppJson.decodeFromString<VisitList>(it).visits }.getOrNull() }
            .orEmpty()
        val serverIds = server.map { it.id }.toSet()
        val names = bundle().master
        fun nameOf(list: List<MasterItem>, id: String) = list.firstOrNull { it.id == id }?.name ?: "Unknown"

        val local = store.all(RecordKind.VISIT).mapNotNull { record ->
            val draft = runCatching { AppJson.decodeFromString<VisitDraft>(record.body) }.getOrNull()
                ?: return@mapNotNull null
            if (draft.demoPlotId != plotId) return@mapNotNull null
            if (record.state == RecordState.SENT && record.serverId in serverIds) return@mapNotNull null
            HistoryVisit(
                key = record.id,
                actionPlan = draft.actionPlan,
                comments = draft.comments,
                createdAt = record.createdAt.toString(),
                visitedBy = session()?.user?.name,
                issues = draft.issueTypeIds.map { nameOf(names.issueTypes, it) },
                goodThings = draft.goodThingIds.map { nameOf(names.goodThings, it) },
                diseases = draft.diseaseIds.map { nameOf(names.diseases, it) } + listOfNotNull(draft.diseaseOther.ifBlank { null }),
                pests = draft.pestIds.map { nameOf(names.pests, it) } + listOfNotNull(draft.pestOther.ifBlank { null }),
                photoUrl = null,
                localPhoto = draft.photos[VisitRules.OVERALL_PHOTO],
                localState = record.state,
                error = record.error,
                recordId = record.id,
            )
        }
        val remoteVisits = server.map { v ->
            HistoryVisit(
                key = v.id,
                actionPlan = v.actionPlan,
                comments = v.comments,
                createdAt = v.createdAt,
                visitedBy = v.visitedByName,
                issues = v.issues.mapNotNull { it.name },
                goodThings = v.goodThings.mapNotNull { it.name },
                diseases = v.diseases.mapNotNull { it.name },
                pests = v.pests.mapNotNull { it.name },
                photoUrl = v.overallPhotoUrl,
                localPhoto = null,
                localState = null,
            )
        }
        return local + remoteVisits
    }

    // --- Issues (read from the server, last copy kept for offline viewing) ---

    /** [box] is "assigned" or "raised". */
    suspend fun fetchIssues(box: String): List<Issue> = withContext(io) {
        val path = if (box == "raised") "/issues/raised-by-me" else "/issues/assigned-to-me"
        val text = remote.get(path)
        store.putValue("$KEY_ISSUES$box", text)
        AppJson.decodeFromString<IssueList>(text).issues
    }

    fun cachedIssues(box: String): List<Issue> = store.getValue("$KEY_ISSUES$box")
        ?.let { runCatching { AppJson.decodeFromString<IssueList>(it).issues }.getOrNull() }
        .orEmpty()

    fun cachedIssue(id: String): Issue? =
        (cachedIssues("assigned") + cachedIssues("raised")).firstOrNull { it.id == id }

    /** Issues waiting on this user (the badge on the Issues tab). */
    suspend fun fetchIssuesNeedingAction(): Int = withContext(io) {
        val count = AppJson.decodeFromString<IssueStatsResponse>(remote.get("/issues/stats")).stats.needsAction
        store.putValue(KEY_NEEDS_ACTION, count.toString())
        count
    }

    fun cachedIssuesNeedingAction(): Int = store.getValue(KEY_NEEDS_ACTION)?.toIntOrNull() ?: 0

    fun retryRecord(id: String) {
        store.retry(id)
        refreshCounts()
    }

    fun discardRecord(id: String) {
        (store.all(RecordKind.VISIT) + store.all(RecordKind.FARMER)).firstOrNull { it.id == id }?.let(::deletePhotos)
        store.delete(id)
        refreshCounts()
    }

    // --- Sync ---

    /**
     * Sends everything pending, oldest first, then refreshes the downloaded
     * copy. Stops (keeping everything on the phone) when there is no
     * connection or the login is refused. A record the server rejects is set
     * aside as "needs attention" and the rest carry on.
     */
    suspend fun syncNow(): SyncStatus = withContext(io) {
        syncLock.withLock {
            _status.value = _status.value.copy(syncing = true, lastError = null)
            var error: String? = null
            try {
                sendPending()
                downloadBundle()
                // Keep the Issues badge current; not worth failing a sync over.
                runCatching { fetchIssuesNeedingAction() }
            } catch (e: ApiException) {
                error = when {
                    e.relogin -> "Your login has expired. Log in again - your saved work stays on this phone."
                    e.offline -> "No connection. Your work is saved on this phone and will be sent later."
                    else -> e.message
                }
            }
            val finished = error == null
            _status.value = currentCounts().copy(
                syncing = false,
                lastSyncAt = if (finished) now() else _status.value.lastSyncAt,
                lastError = error,
            )
            _status.value
        }
    }

    /** Sends pending records. Throws only for offline / relogin, which stop the whole run. */
    internal fun sendPending(): Int {
        var sent = 0
        for (record in store.byState(RecordState.PENDING)) {
            if (record.kind == RecordKind.ISSUE_ACTION) {
                if (sendIssueAction(record)) sent++
                refreshCounts()
                continue
            }
            if (record.kind == RecordKind.FARMER) {
                if (sendFarmer(record)) sent++
                refreshCounts()
                continue
            }
            if (record.kind != RecordKind.VISIT) continue
            val draft = runCatching { AppJson.decodeFromString<VisitDraft>(record.body) }.getOrElse {
                store.markAttention(record.id, "This record is damaged and can't be sent")
                continue
            }
            try {
                val files = draft.photos.map { (field, path) -> FilePart(field, File(path)) }
                val missing = files.firstOrNull { !it.file.exists() }
                if (missing != null) {
                    store.markAttention(record.id, "A photo for this visit is missing from the phone")
                    continue
                }
                val response = remote.postMultipart("/visits", VisitRules.formFields(draft), files)
                val serverId = runCatching {
                    AppJson.parseToJsonElement(response).let { json ->
                        (json as kotlinx.serialization.json.JsonObject)["visit"]
                            ?.let { it as kotlinx.serialization.json.JsonObject }
                            ?.get("id")?.toString()?.trim('"')
                    }
                }.getOrNull()
                store.markSent(record.id, serverId)
                deletePhotos(record)
                sent++
            } catch (e: ApiException) {
                if (e.offline || e.relogin) throw e
                store.markAttention(record.id, e.message ?: "The server refused this visit")
            }
            refreshCounts()
        }
        refreshCounts()
        return sent
    }

    /** One queued issue action. Returns true when the server accepted it. */
    private fun sendIssueAction(record: OutboxRecord): Boolean {
        val draft = runCatching { AppJson.decodeFromString<IssueActionDraft>(record.body) }.getOrNull()
        val action = draft?.issueAction
        if (draft == null || action == null) {
            store.markAttention(record.id, "This record is damaged and can't be sent")
            return false
        }
        return try {
            remote.postJson("/issues/${draft.issueId}/${action.path}", draft.body)
            store.markSent(record.id, draft.issueId)
            true
        } catch (e: ApiException) {
            if (e.offline || e.relogin) throw e
            // Usually someone else acted first (e.g. "not waiting to be
            // started"); the user sees the reason and can discard it.
            store.markAttention(record.id, e.message ?: "The server refused this action")
            false
        }
    }

    /** One new farmer. Returns true when the server has it. */
    private fun sendFarmer(record: OutboxRecord): Boolean {
        val draft = runCatching { AppJson.decodeFromString<FarmerDraft>(record.body) }.getOrNull()
        if (draft == null) {
            store.markAttention(record.id, "This record is damaged and can't be sent")
            return false
        }
        val files = listOfNotNull(draft.photo?.let { FilePart("photo", File(it)) }).filter { it.file.exists() }
        return try {
            val response = remote.postMultipart("/farmers", FarmerRules.formFields(draft), files)
            val serverId = runCatching {
                (AppJson.parseToJsonElement(response) as kotlinx.serialization.json.JsonObject)["farmer"]
                    ?.let { it as kotlinx.serialization.json.JsonObject }?.get("id")?.toString()?.trim('"')
            }.getOrNull()
            store.markSent(record.id, serverId)
            draft.photo?.let { runCatching { deleteFile(it) } }
            true
        } catch (e: ApiException) {
            if (e.offline || e.relogin) throw e
            // e.g. "Asha is already registered with this phone number." when
            // someone else registered the same farmer while this phone was offline.
            store.markAttention(record.id, e.message ?: "The server refused this farmer")
            false
        }
    }

    // --- Farmers registered on this phone ---

    /** Who already has [phone]: the downloaded farmers, then ones registered here and not sent yet. */
    fun phoneOwner(phone: String): String? =
        bundle().farmers.firstOrNull { it.phone == phone }?.name
            ?: unsentFarmers().firstOrNull { it.second.phone == phone }?.second?.name

    /** Saves a new farmer on the phone. Returns an error, or null when saved. */
    fun saveFarmer(draft: FarmerDraft): String? {
        val clean = draft.copy(phone = FarmerRules.cleanPhone(draft.phone), name = draft.name.trim())
        FarmerRules.validate(clean, phoneOwner(clean.phone))?.let { return it }
        store.add(OutboxRecord(clean.clientId, RecordKind.FARMER, AppJson.encodeToString(clean), RecordState.PENDING, clean.createdAtMillis.takeIf { it > 0 } ?: now()))
        refreshCounts()
        return null
    }

    private fun unsentFarmers(): List<Pair<OutboxRecord, FarmerDraft>> =
        store.all(RecordKind.FARMER).filter { it.state != RecordState.SENT }.mapNotNull { record ->
            runCatching { AppJson.decodeFromString<FarmerDraft>(record.body) }.getOrNull()?.let { record to it }
        }

    /** Farmers registered on this phone and not on the server yet, shaped like downloaded ones. */
    fun localFarmers(): List<Farmer> = unsentFarmers().map { (record, draft) -> FarmerRules.asFarmer(draft, record.state) }

    /** The outbox record behind a local farmer id ("local:<clientId>"). */
    fun localFarmerRecord(farmerId: String): OutboxRecord? =
        store.all(RecordKind.FARMER).firstOrNull { FarmerRules.LOCAL_PREFIX + it.id == farmerId }

    // --- Issue actions ---

    /** Saves an action on the phone to send with the next sync. Returns an error, or null. */
    fun saveIssueAction(issue: Issue, action: IssueAction, note: String, clientId: String): String? {
        if (!action.offline) return "${action.label} needs a connection"
        if (action.note == NoteRule.Required && note.isBlank()) return "Please add a note"
        if (pendingIssueAction(issue.id) != null) return "An action for this issue is already waiting to be sent"
        val draft = IssueActionDraft(clientId, issue.id, action.name, action.body(note), now())
        store.add(OutboxRecord(clientId, RecordKind.ISSUE_ACTION, AppJson.encodeToString(draft), RecordState.PENDING, draft.createdAtMillis))
        refreshCounts()
        return null
    }

    /** The unsent (or refused) action for an issue, if any - one at a time per issue. */
    fun pendingIssueAction(issueId: String): Pair<OutboxRecord, IssueActionDraft>? =
        store.all(RecordKind.ISSUE_ACTION)
            .filter { it.state != RecordState.SENT }
            .firstNotNullOfOrNull { record ->
                runCatching { AppJson.decodeFromString<IssueActionDraft>(record.body) }.getOrNull()
                    ?.takeIf { it.issueId == issueId }
                    ?.let { record to it }
            }

    /** People this issue can go to, for Assign (raised issues) or Reassign. Needs a connection. */
    suspend fun assignableUsers(issue: Issue, action: IssueAction): List<AssignableUser> = withContext(io) {
        val village = issue.villageId ?: return@withContext emptyList()
        val path = if (action == IssueAction.Assign) {
            "/issues/assignable-users?villageId=$village&issueId=${issue.id}"
        } else {
            "/issues/reassignable-users?villageId=$village"
        }
        AppJson.decodeFromString<AssignableUsers>(remote.get(path)).users
    }

    /** Assign / Reassign go straight to the server. */
    suspend fun sendIssueActionNow(issue: Issue, action: IssueAction, note: String, assignedTo: String) = withContext(io) {
        remote.postJson("/issues/${issue.id}/${action.path}", action.body(note, assignedTo))
    }

    private fun deletePhotos(record: OutboxRecord) {
        if (record.kind == RecordKind.FARMER) {
            runCatching { AppJson.decodeFromString<FarmerDraft>(record.body).photo?.let(deleteFile) }
            return
        }
        val draft = runCatching { AppJson.decodeFromString<VisitDraft>(record.body) }.getOrNull() ?: return
        draft.photos.values.forEach { runCatching { deleteFile(it) } }
    }

    private fun currentCounts() = _status.value.copy(
        pending = store.countByState(RecordState.PENDING),
        attention = store.countByState(RecordState.ATTENTION),
    )

    fun refreshCounts() {
        _status.value = currentCounts()
    }

    companion object {
        const val KEY_SESSION = "session"
        const val KEY_BUNDLE = "bundle"
        const val KEY_VISITS = "visits:"
        const val KEY_ISSUES = "issues:"
        const val KEY_NEEDS_ACTION = "issues-needs-action"
    }
}
