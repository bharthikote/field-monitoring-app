package com.fieldmonitoring.app.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.fieldmonitoring.app.FieldSightApp
import java.util.concurrent.TimeUnit

/**
 * Background sync (PRD section 10: "auto-sync whenever connectivity is
 * detected"). WorkManager only runs it when the phone has a connection, and
 * keeps it across restarts.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repository = (applicationContext as FieldSightApp).repository
        if (repository.session() == null) return Result.success()
        val status = repository.syncNow()
        // No connection after all: try again later with backoff. Any other
        // problem is shown to the user rather than retried in a loop.
        return if (status.lastError != null && status.pending > 0) Result.retry() else Result.success()
    }

    companion object {
        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** Every 15 minutes while online (the shortest period Android allows). */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(online)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork("fieldsight-sync", ExistingPeriodicWorkPolicy.KEEP, request)
        }

        /** As soon as there is a connection - called after every save. */
        fun soon(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(online)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("fieldsight-sync-now", ExistingWorkPolicy.REPLACE, request)
        }
    }
}
