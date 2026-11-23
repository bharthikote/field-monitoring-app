package com.fieldmonitoring.app.data

/**
 * A record saved on the phone and waiting for the server. States:
 * - pending: waiting to be sent
 * - sent: the server has it ([serverId] set); kept so history can show it
 * - attention: the server refused it; [error] says why and the user decides
 */
data class OutboxRecord(
    val id: String,
    val kind: String,
    val body: String,
    val state: String,
    val createdAt: Long,
    val error: String? = null,
    val serverId: String? = null,
)

object RecordState {
    const val PENDING = "pending"
    const val SENT = "sent"
    const val ATTENTION = "attention"
}

object RecordKind {
    const val VISIT = "visit"
    const val ISSUE_ACTION = "issue_action"
    const val FARMER = "farmer"
}

/** Storage the sync code uses; SQLite on the phone, in-memory in tests. */
interface OutboxStore {
    fun add(record: OutboxRecord)
    fun byState(state: String): List<OutboxRecord>
    fun all(kind: String): List<OutboxRecord>
    fun markSent(id: String, serverId: String?)
    fun markAttention(id: String, error: String)
    fun retry(id: String)
    fun delete(id: String)
    fun countByState(state: String): Int

    fun getValue(key: String): String?
    fun putValue(key: String, value: String)
    fun clearAll()
}
