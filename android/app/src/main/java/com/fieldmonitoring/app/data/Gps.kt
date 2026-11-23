package com.fieldmonitoring.app.data

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import androidx.core.location.LocationManagerCompat
import android.os.CancellationSignal
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.Executors
import kotlin.coroutines.resume

data class GpsFix(val lat: Double, val lng: Double, val accuracy: Float, val timeMillis: Long)

/**
 * Location without Google Play Services: a fresh fix from GPS (or the
 * network provider) within [timeoutMs], falling back to the last known
 * position if it is under 5 minutes old. Works offline - GPS needs no data.
 */
object Gps {
    const val GOOD_ACCURACY_M = 20f

    @SuppressLint("MissingPermission")
    suspend fun current(context: Context, timeoutMs: Long = 20_000): GpsFix? {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> return null
        }
        val fresh = withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Location?> { cont ->
                val cancel = CancellationSignal()
                cont.invokeOnCancellation { cancel.cancel() }
                LocationManagerCompat.getCurrentLocation(
                    manager, provider, cancel, Executors.newSingleThreadExecutor(),
                ) { location -> if (cont.isActive) cont.resume(location) }
            }
        }
        val location = fresh ?: listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .filter { System.currentTimeMillis() - it.time < 5 * 60_000 }
            .minByOrNull { it.accuracy }
        return location?.let { GpsFix(it.latitude, it.longitude, it.accuracy, it.time) }
    }
}
