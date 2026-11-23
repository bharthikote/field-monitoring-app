# FieldSight (Android)

The native Kotlin + Jetpack Compose phone app that replaces the Expo app in
`../mobile`. It works offline: after the first login it downloads the user's
villages, farmers, plots and the visit-form lists, saves new work on the
phone, and sends it when there is a connection. Plan and phases:
[../docs/android-rebuild-plan.md](../docs/android-rebuild-plan.md). Design system:
[../.claude/skills/field-app-ui/SKILL.md](../.claude/skills/field-app-ui/SKILL.md).

## What you need

- JDK 21 (Microsoft OpenJDK is installed at `C:\Program Files\Microsoft\jdk-21...`).
- The Android SDK at `%USERPROFILE%\tools\android-sdk` with `platforms;android-37`,
  `build-tools;37.0.0` and `platform-tools`. It lives outside AppData because
  files the Claude desktop app writes under AppData aren't visible to other
  programs (same setup as the TVM app).
- `android/local.properties` (git-ignored) with
  `sdk.dir=C\:\\Users\\<you>\\tools\\android-sdk`. Optionally
  `fieldsight.apiUrl=http://<laptop-ip>:4000` to point debug builds at a local backend.

Gradle itself is downloaded by the wrapper (`gradlew.bat`) on the first build.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File android\build.ps1            # tests + release APK
powershell -ExecutionPolicy Bypass -File android\build.ps1 -Install   # ...and install over USB
```

The release APK is at `android/app/build/outputs/apk/release/app-release.apk`.
It is signed with the debug key for testing; a real release key comes in phase 6.
Uninstall the old Expo app first: it has the same app ID but a different key.

## Code map (`app/src/main/java/com/fieldmonitoring/app/`)

| Path | What it does |
| --- | --- |
| `data/Repository.kt` | Login, bundle download, outbox, sync. Screens only talk to this. |
| `data/LocalStore.kt` | SQLite: `kv` (downloaded JSON) and `records` (outbox). |
| `data/Api.kt` | HTTP client (HttpURLConnection) and the multipart writer. |
| `data/SyncWorker.kt` | WorkManager: every 15 min online, and soon after each save. |
| `data/VisitRules.kt` | The visit form's rules, same as `POST /visits`. |
| `data/Gps.kt`, `data/Photos.kt` | Location without Play Services; compressed photos kept until sent. |
| `ui/theme`, `ui/components` | Tokens and components from the `field-app-ui` skill. |
| `ui/screens` | Login, Home + menu, Farmers, Farmer, Plots, Plot, Log Visit, Profile. |

Unit tests are in `app/src/test` (`gradlew testDebugUnitTest`).
