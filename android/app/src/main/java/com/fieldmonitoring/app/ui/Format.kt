package com.fieldmonitoring.app.ui

import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** One formatter for dates and labels app-wide (skill section 5). */
object Format {
    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yy", Locale.UK)
    private val dateTimeFmt = DateTimeFormatter.ofPattern("dd/MM/yy HH:mm", Locale.UK)

    /** Accepts server ISO timestamps or local epoch millis (as a string). */
    fun dateTime(raw: String?): String {
        if (raw.isNullOrBlank()) return "-"
        val instant = raw.toLongOrNull()?.let(Instant::ofEpochMilli)
            ?: runCatching { Instant.parse(raw) }.getOrNull()
            ?: return raw.take(10)
        return dateTimeFmt.format(instant.atZone(ZoneId.systemDefault()))
    }

    fun date(raw: String?): String {
        if (raw.isNullOrBlank()) return "-"
        val instant = raw.toLongOrNull()?.let(Instant::ofEpochMilli)
            ?: runCatching { Instant.parse(raw) }.getOrNull()
        if (instant != null) return dateFmt.format(instant.atZone(ZoneId.systemDefault()))
        // Plain YYYY-MM-DD (birth dates)
        return runCatching {
            val d = SimpleDateFormat("yyyy-MM-dd", Locale.UK).parse(raw)!!
            SimpleDateFormat("dd/MM/yy", Locale.UK).format(d)
        }.getOrDefault(raw)
    }

    /** "key_farmer" -> "Key Farmer" */
    fun label(raw: String?): String =
        raw?.split('_')?.joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } } ?: "-"

    fun role(raw: String): String = when (raw) {
        "tfo" -> "TFO"
        else -> label(raw)
    }

    fun gender(raw: String?): String = when (raw) {
        "male" -> "M"
        "female" -> "F"
        "others" -> "Other"
        else -> ""
    }

    fun ago(millis: Long?, now: Long = System.currentTimeMillis()): String {
        if (millis == null) return "never"
        val minutes = (now - millis) / 60_000
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "$minutes min ago"
            minutes < 24 * 60 -> "${minutes / 60} h ago"
            else -> "${minutes / (24 * 60)} days ago"
        }
    }
}
