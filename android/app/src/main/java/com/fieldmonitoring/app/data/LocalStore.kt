package com.fieldmonitoring.app.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * The phone's own database (fieldsight.db): `kv` holds downloaded data as
 * JSON, `records` is the outbox. Upgrades only ever add - records collected
 * in the field must never be dropped.
 */
class LocalStore(context: Context) :
    SQLiteOpenHelper(context, "fieldsight.db", null, 1), OutboxStore {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("create table kv (key text primary key, value text not null, updated_at integer not null)")
        db.execSQL(
            """create table records (
                id text primary key, kind text not null, body text not null, state text not null,
                created_at integer not null, updated_at integer not null, error text, server_id text)""",
        )
        db.execSQL("create index records_state on records(kind, state)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    override fun add(record: OutboxRecord) {
        writableDatabase.insertOrThrow("records", null, ContentValues().apply {
            put("id", record.id)
            put("kind", record.kind)
            put("body", record.body)
            put("state", record.state)
            put("created_at", record.createdAt)
            put("updated_at", System.currentTimeMillis())
        })
    }

    override fun byState(state: String) =
        query("select * from records where state = ? order by created_at", state)

    override fun all(kind: String) =
        query("select * from records where kind = ? order by created_at desc", kind)

    override fun markSent(id: String, serverId: String?) = update(id, RecordState.SENT, null, serverId)
    override fun markAttention(id: String, error: String) = update(id, RecordState.ATTENTION, error, null)
    override fun retry(id: String) = update(id, RecordState.PENDING, null, null)

    override fun delete(id: String) {
        writableDatabase.delete("records", "id = ?", arrayOf(id))
    }

    override fun countByState(state: String): Int =
        readableDatabase.rawQuery("select count(*) from records where state = ?", arrayOf(state)).use {
            it.moveToFirst(); it.getInt(0)
        }

    override fun getValue(key: String): String? =
        readableDatabase.rawQuery("select value from kv where key = ?", arrayOf(key)).use {
            if (it.moveToFirst()) it.getString(0) else null
        }

    override fun putValue(key: String, value: String) {
        writableDatabase.insertWithOnConflict("kv", null, ContentValues().apply {
            put("key", key)
            put("value", value)
            put("updated_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    override fun clearAll() {
        writableDatabase.delete("records", null, null)
        writableDatabase.delete("kv", null, null)
    }

    private fun update(id: String, state: String, error: String?, serverId: String?) {
        writableDatabase.update("records", ContentValues().apply {
            put("state", state)
            put("error", error)
            if (serverId != null) put("server_id", serverId)
            put("updated_at", System.currentTimeMillis())
        }, "id = ?", arrayOf(id))
    }

    private fun query(sql: String, vararg args: String): List<OutboxRecord> =
        readableDatabase.rawQuery(sql, args).use { c -> buildList { while (c.moveToNext()) add(c.toRecord()) } }

    private fun Cursor.toRecord() = OutboxRecord(
        id = getString(getColumnIndexOrThrow("id")),
        kind = getString(getColumnIndexOrThrow("kind")),
        body = getString(getColumnIndexOrThrow("body")),
        state = getString(getColumnIndexOrThrow("state")),
        createdAt = getLong(getColumnIndexOrThrow("created_at")),
        error = getString(getColumnIndexOrThrow("error")),
        serverId = getString(getColumnIndexOrThrow("server_id")),
    )
}
