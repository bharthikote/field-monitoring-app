package com.fieldmonitoring.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files

class ApiTest {
    @Test fun serverErrorMessageAndCodeAreKept() {
        val e = Api.errorFor(409, """{"error":"This phone number is already registered to Asha.","code":"name_mismatch"}""")
        assertEquals("This phone number is already registered to Asha.", e.message)
        assertEquals("name_mismatch", e.code)
        assertFalse(e.offline)
        assertFalse(e.relogin)
    }

    @Test fun unauthorizedMeansLogInAgain() = assertTrue(Api.errorFor(401, "{}").relogin)

    @Test fun renderWakingUpCountsAsOffline() {
        // A sleeping Render service answers 502/503 for a while: keep the work and retry later.
        assertTrue(Api.errorFor(503, "<html>").offline)
        assertEquals("Server error (503)", Api.errorFor(503, "<html>").message)
    }

    @Test fun multipartHasFieldsThenFilesAndClosingBoundary() {
        val photo = File(Files.createTempDirectory("mp").toFile(), "a.jpg").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val out = ByteArrayOutputStream()
        Multipart.write(out, "B", listOf("clientId" to "x"), listOf(FilePart("overallPhoto", photo)))
        val text = out.toString(Charsets.ISO_8859_1.name())
        assertTrue(text.startsWith("--B\r\nContent-Disposition: form-data; name=\"clientId\"\r\n"))
        assertTrue(text.contains("name=\"overallPhoto\"; filename=\"a.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n\u0001\u0002\u0003\r\n"))
        assertTrue(text.endsWith("--B--\r\n"))
    }
}
