package com.fieldmonitoring.app.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material3.Text
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Loads a photo from a URL (or a local file path) without an image library:
 * memory cache, then a disk cache in the app's cache folder (so photos seen
 * once still show offline), then the network. Large photos are scaled down
 * to about [maxSide] px when decoded.
 */
object ImageLoader {
    private val memory = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    private fun diskFile(context: Context, url: String): File {
        val name = MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(File(context.cacheDir, "images").apply { mkdirs() }, name)
    }

    suspend fun load(context: Context, source: String, maxSide: Int = 1200): Bitmap? {
        memory.get(source)?.let { return it }
        return withContext(Dispatchers.IO) {
            runCatching {
                val file = if (source.startsWith("http")) {
                    diskFile(context, source).also { cached ->
                        if (!cached.exists()) {
                            val conn = URL(source).openConnection() as HttpURLConnection
                            conn.connectTimeout = 15_000
                            conn.readTimeout = 30_000
                            try {
                                val tmp = File(cached.path + ".part")
                                conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
                                tmp.renameTo(cached)
                            } finally {
                                conn.disconnect()
                            }
                        }
                    }
                } else {
                    File(source)
                }
                decode(file, maxSide)?.also { memory.put(source, it) }
            }.getOrNull()
        }
    }

    private fun decode(file: File, maxSide: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        return BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }
}

@Composable
fun RemoteImage(source: String, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop, maxSide: Int = 1200) {
    val context = LocalContext.current
    var bitmap by remember(source) { mutableStateOf<Bitmap?>(null) }
    var failed by remember(source) { mutableStateOf(false) }
    LaunchedEffect(source) {
        bitmap = ImageLoader.load(context, source, maxSide)
        failed = bitmap == null
    }
    val b = bitmap
    if (b != null) {
        Image(b.asImageBitmap(), contentDescription = "Photo", contentScale = contentScale, modifier = modifier)
    } else {
        Box(modifier.background(Fs.Field), contentAlignment = Alignment.Center) {
            Text(if (failed) "Photo not available offline" else "Loading photo...", style = FsText.Label)
        }
    }
}
