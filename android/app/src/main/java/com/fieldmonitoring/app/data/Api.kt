package com.fieldmonitoring.app.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * A failed server call. [offline] means the phone couldn't reach the server
 * (keep everything and try later); [relogin] means the saved login is no
 * longer accepted. [code] is the server's machine-readable error code.
 */
class ApiException(
    message: String,
    val status: Int = 0,
    val offline: Boolean = false,
    val relogin: Boolean = false,
    val code: String? = null,
) : Exception(message)

data class FilePart(val field: String, val file: File, val mimeType: String = "image/jpeg")

/** What the sync code needs from the network; faked in tests. */
interface Remote {
    fun get(path: String): String
    fun postJson(path: String, body: String): String
    fun postMultipart(path: String, fields: List<Pair<String, String>>, files: List<FilePart>): String
    fun delete(path: String): String
}

/** The backend's REST API over plain HttpURLConnection (no extra libraries). */
class Api(private val baseUrl: String, private val token: () -> String?) : Remote {

    override fun get(path: String) = call(path, "GET", null, null)

    override fun delete(path: String) = call(path, "DELETE", null, null)

    override fun postJson(path: String, body: String) =
        call(path, "POST", "application/json; charset=utf-8") { it.write(body.toByteArray()) }

    override fun postMultipart(path: String, fields: List<Pair<String, String>>, files: List<FilePart>): String {
        val boundary = "fieldsight-" + UUID.randomUUID()
        return call(path, "POST", "multipart/form-data; boundary=$boundary") { out ->
            Multipart.write(out, boundary, fields, files)
        }
    }

    private fun call(path: String, method: String, contentType: String?, body: ((OutputStream) -> Unit)?): String {
        val conn: HttpURLConnection
        try {
            conn = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        } catch (e: IOException) {
            throw ApiException("No connection", offline = true)
        }
        try {
            conn.requestMethod = method
            conn.connectTimeout = 20_000
            conn.readTimeout = 90_000 // a visit with several photos can take a while on 2G
            conn.setRequestProperty("Accept", "application/json")
            token()?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", contentType)
                conn.setChunkedStreamingMode(64 * 1024)
                conn.outputStream.use(body)
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (status in 200..299) return text
            throw errorFor(status, text)
        } catch (e: ApiException) {
            throw e
        } catch (e: IOException) {
            throw ApiException("No connection to the server", offline = true)
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        /** Turns an error response into an ApiException with the server's own message. */
        fun errorFor(status: Int, text: String): ApiException {
            val obj = runCatching { AppJson.parseToJsonElement(text) as JsonObject }.getOrNull()
            val message = obj?.get("error")?.jsonPrimitive?.contentOrNull ?: "Server error ($status)"
            val code = obj?.get("code")?.jsonPrimitive?.contentOrNull
            return ApiException(
                message,
                status = status,
                offline = status == 502 || status == 503 || status == 504,
                relogin = status == 401,
                code = code,
            )
        }
    }
}

/** multipart/form-data writer, kept separate so it can be unit tested. */
object Multipart {
    fun write(out: OutputStream, boundary: String, fields: List<Pair<String, String>>, files: List<FilePart>) {
        fun line(s: String = "") = out.write((s + "\r\n").toByteArray())
        for ((name, value) in fields) {
            line("--$boundary")
            line("Content-Disposition: form-data; name=\"$name\"")
            line("Content-Type: text/plain; charset=utf-8")
            line()
            line(value)
        }
        for (part in files) {
            line("--$boundary")
            line("Content-Disposition: form-data; name=\"${part.field}\"; filename=\"${part.file.name}\"")
            line("Content-Type: ${part.mimeType}")
            line()
            part.file.inputStream().use { it.copyTo(out) }
            line()
        }
        line("--$boundary--")
    }
}
