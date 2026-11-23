package com.fieldmonitoring.app.data

/** In-memory outbox, same behaviour as LocalStore. */
class FakeStore : OutboxStore {
    val records = linkedMapOf<String, OutboxRecord>()
    val kv = mutableMapOf<String, String>()

    override fun add(record: OutboxRecord) {
        require(record.id !in records) { "duplicate id" }
        records[record.id] = record
    }
    override fun byState(state: String) = records.values.filter { it.state == state }.sortedBy { it.createdAt }
    override fun all(kind: String) = records.values.filter { it.kind == kind }.sortedByDescending { it.createdAt }
    override fun markSent(id: String, serverId: String?) {
        records[id] = records.getValue(id).copy(state = RecordState.SENT, error = null, serverId = serverId)
    }
    override fun markAttention(id: String, error: String) {
        records[id] = records.getValue(id).copy(state = RecordState.ATTENTION, error = error)
    }
    override fun retry(id: String) {
        records[id] = records.getValue(id).copy(state = RecordState.PENDING, error = null)
    }
    override fun delete(id: String) { records.remove(id) }
    override fun countByState(state: String) = records.values.count { it.state == state }
    override fun getValue(key: String) = kv[key]
    override fun putValue(key: String, value: String) { kv[key] = value }
    override fun clearAll() { records.clear(); kv.clear() }
}

/** Scripted server: each multipart POST takes the next answer from [answers]. */
class FakeRemote : Remote {
    val answers = ArrayDeque<() -> String>()
    val posted = mutableListOf<List<Pair<String, String>>>()
    var bundle = """{"serverTime":"2026-11-23T00:00:00Z","villages":[],"farmers":[],"demoPlots":[],"openIssues":[],"master":{}}"""

    var issues = """{"issues":[]}"""

    override fun get(path: String): String = when {
        path == "/sync/bundle" -> bundle
        path == "/issues/stats" -> """{"stats":{"assigned":1,"needs_action":3,"closed":0}}"""
        path.startsWith("/issues/assigned") -> issues
        path.startsWith("/issues/") -> """{"issues":[]}"""
        else -> """{"visits":[]}"""
    }
    override fun postJson(path: String, body: String): String =
        """{"token":"t","user":{"id":"u1","name":"Asha","role":"tfo"}}"""
    override fun postMultipart(path: String, fields: List<Pair<String, String>>, files: List<FilePart>): String {
        posted += fields
        return answers.removeFirst().invoke()
    }
}
