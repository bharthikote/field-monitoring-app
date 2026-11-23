package com.fieldmonitoring.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/** Whether an action asks for a note, and whether it must have one. */
enum class NoteRule { None, Optional, Required }

/**
 * Everything the holder of an issue can do, mirroring the rules in
 * backend/src/routes/issues.js. [path] is the endpoint after /issues/:id/.
 * [offline]: the action needs no extra data from the server, so it can be
 * saved on the phone and sent later. Assign and Reassign pick a person from
 * a list only the server can give, so they need a connection.
 */
enum class IssueAction(
    val path: String,
    val label: String,
    val note: NoteRule,
    val noteLabel: String,
    val offline: Boolean,
    val destructive: Boolean = false,
) {
    Assign("assign", "Assign", NoteRule.None, "", offline = false),
    Start("start", "Start work", NoteRule.None, "", offline = true),
    Resolve("resolve", "Mark resolved", NoteRule.Optional, "What was done (optional)", offline = true),
    Acknowledge("acknowledge", "Acknowledge", NoteRule.Optional, "Note (optional)", offline = true),
    Reassign("reassign", "Reassign", NoteRule.Required, "Why are you reassigning it?", offline = false),
    Dispute("dispute", "Dispute", NoteRule.Required, "Why don't you think this is a real issue?", offline = true, destructive = true),
    Approve("verify", "Approve and close", NoteRule.Optional, "Note (optional)", offline = true),
    Reject("verify", "Reject and reopen", NoteRule.Required, "What still needs doing?", offline = true, destructive = true),
    Genuine("dispute-review", "Genuine - resolve and close", NoteRule.Optional, "What was done (optional)", offline = true),
    Dismiss("dispute-review", "Not genuine - dismiss", NoteRule.Required, "Why is it being dismissed?", offline = true, destructive = true),
    ;

    /** The JSON body the server reads for this action. */
    fun body(note: String, assignedTo: String? = null): String = buildJsonObject {
        val trimmed = note.trim()
        when (this@IssueAction) {
            Assign -> put("assignedTo", JsonPrimitive(assignedTo))
            Start -> Unit
            Reassign -> {
                put("assignedTo", JsonPrimitive(assignedTo))
                put("comment", JsonPrimitive(trimmed))
            }
            Approve -> { put("approved", JsonPrimitive(true)); put("note", JsonPrimitive(trimmed)) }
            Reject -> { put("approved", JsonPrimitive(false)); put("note", JsonPrimitive(trimmed)) }
            Genuine -> { put("genuine", JsonPrimitive(true)); put("note", JsonPrimitive(trimmed)) }
            Dismiss -> { put("genuine", JsonPrimitive(false)); put("note", JsonPrimitive(trimmed)) }
            else -> put("note", JsonPrimitive(trimmed))
        }
    }.toString()

    companion object {
        /**
         * What [me] may do with [issue] right now - the same checks the server
         * makes, so the phone never offers a button that would be refused.
         */
        fun available(issue: Issue, me: String?): List<IssueAction> {
            if (me == null) return emptyList()
            val holder = issue.assignedToId == me
            return buildList {
                if (issue.status == "raised" && issue.raisedById == me) add(Assign)
                if (!holder) return@buildList
                when (issue.status) {
                    "assigned", "in_progress" -> {
                        if (issue.status == "assigned") add(Start)
                        add(if (issue.acknowledgeOnly) Acknowledge else Resolve)
                        add(Reassign)
                        // The person who raised it is vouching that it's real.
                        if (issue.raisedById != me) add(Dispute)
                    }
                    "pending_verification" -> { add(Approve); add(Reject) }
                    "disputed" -> { add(Genuine); add(Dismiss) }
                }
            }
        }
    }
}

/** An issue action saved on the phone, waiting to be sent (outbox kind "issue_action"). */
@Serializable
data class IssueActionDraft(
    val clientId: String,
    val issueId: String,
    val action: String, // IssueAction name
    val body: String,
    val createdAtMillis: Long = 0,
) {
    val issueAction: IssueAction? get() = IssueAction.entries.firstOrNull { it.name == action }
}

@Serializable
data class AssignableUser(val id: String, val name: String, val role: String? = null)

@Serializable
data class AssignableUsers(val users: List<AssignableUser> = emptyList())
