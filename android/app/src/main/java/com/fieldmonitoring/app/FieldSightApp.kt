package com.fieldmonitoring.app

import android.app.Application
import com.fieldmonitoring.app.data.Api
import com.fieldmonitoring.app.data.LocalStore
import com.fieldmonitoring.app.data.Repository
import com.fieldmonitoring.app.data.SyncWorker

class FieldSightApp : Application() {
    lateinit var repository: Repository
        private set

    override fun onCreate() {
        super.onCreate()
        val store = LocalStore(this)
        lateinit var repo: Repository
        val api = Api(BuildConfig.API_URL) { repo.session()?.token }
        repo = Repository(store, api)
        repository = repo
        SyncWorker.schedule(this)
    }
}
