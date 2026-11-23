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
