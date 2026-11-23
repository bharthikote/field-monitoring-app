# kotlinx.serialization: keep generated serializers for the app's models.
-keepattributes *Annotation*, InnerClasses, Signature
-keepclassmembers @kotlinx.serialization.Serializable class com.fieldmonitoring.app.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.fieldmonitoring.app.**$$serializer { *; }
-keepclasseswithmembers class com.fieldmonitoring.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# WorkManager creates the sync worker by name.
-keep class com.fieldmonitoring.app.data.SyncWorker { <init>(...); }
# WorkManager's internal Room database is created by reflection
# (WorkDatabase_Impl.<init>); R8 full mode removed the constructor and the
# release build crashed on start (seen on a Moto, Android 17).
-keep class * extends androidx.room.RoomDatabase { <init>(); }
