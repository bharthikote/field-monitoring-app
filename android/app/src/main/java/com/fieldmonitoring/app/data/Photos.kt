package com.fieldmonitoring.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.core.content.FileProvider
import android.media.ExifInterface
import java.io.File
import java.util.UUID

/**
 * Photos stay on the phone, compressed, until their visit is sent. A 12 MP
 * camera photo (4-6 MB) becomes a ~200-400 KB JPEG at 1600 px, which is
 * plenty for evidence and practical to upload over a weak connection.
 */
object Photos {
    private const val MAX_SIDE = 1600
    private const val QUALITY = 75

    /** A fresh file for the camera app to write into, and the Uri to hand it. */
    fun newCameraTarget(context: Context): Pair<File, Uri> {
        val dir = File(context.cacheDir, "camera").apply { mkdirs() }
        val file = File(dir, "shot-${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.photos", file)
        return file to uri
    }

    /** Copies [source] (camera file or gallery Uri) into app storage, resized and upright. */
    fun keep(context: Context, source: Uri): File? = runCatching {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(source)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0) return null

        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
        val decoded = resolver.openInputStream(source)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null

        val rotation = resolver.openInputStream(source)?.use {
            when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f

        val scale = MAX_SIDE.toFloat() / maxOf(decoded.width, decoded.height)
        val matrix = Matrix().apply {
            if (scale < 1f) postScale(scale, scale)
            if (rotation != 0f) postRotate(rotation)
        }
        val finalBitmap = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)

        val dir = File(context.filesDir, "photos").apply { mkdirs() }
        val out = File(dir, "${UUID.randomUUID()}.jpg")
        out.outputStream().use { finalBitmap.compress(Bitmap.CompressFormat.JPEG, QUALITY, it) }
        out
    }.getOrNull()

    /** Removes camera originals left in the cache. */
    fun clearCameraCache(context: Context) {
        File(context.cacheDir, "camera").listFiles()?.forEach { it.delete() }
    }
}
