// Same toolchain as the TVM app (AGP 9 compiles Kotlin itself, so there is no
// kotlin-android plugin; the Kotlin version comes from these two plugins).
plugins {
    id("com.android.application") version "9.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.4.10" apply false
}
