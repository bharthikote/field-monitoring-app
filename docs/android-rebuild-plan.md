# Android app rebuild plan (Kotlin)

Status: **draft for approval** (2026-11-23). Branch: `kotlin-android-app`.

## Why

The Expo app in `mobile/` is about 89 MB and only works online. The PRD (section 10) says the
phone app must be offline-first: login is the only step that needs internet. The TVM app
(`Documents\tvm-data-app`) shows the target: native Kotlin, small, offline, auto-sync.

The new app lives in `android/`. The Expo app stays as the reference until the new one
covers everything, then it is retired. The backend (`backend/`, Node + Supabase PostgreSQL on
Render) and the web admin stay; they only gain what offline sync needs.

## Technical choices (copied from TVM where it fits)

| Area | Choice | Why |
| --- | --- | --- |
| Build | Gradle 9.8 wrapper, AGP 9.4, Kotlin 2.4 (built-in), compileSdk/targetSdk 37, minSdk 26, Java 17 | Same as TVM, already proven on a phone |
| UI | Jetpack Compose + Material 3, styled by the `field-app-ui` skill | One theme and one component set |
| Navigation | Screen state in a ViewModel (no navigation library) | TVM pattern, smaller APK |
| Local data | Plain SQLite (`SQLiteOpenHelper`): a `kv` table for downloaded data as JSON, a `records` outbox table | TVM pattern; no Room/KSP keeps the build simple and small |
| Network | `HttpURLConnection` + kotlinx-serialization | No OkHttp/Retrofit, smaller APK |
| Sync | WorkManager: every 15 min when online, plus "sync soon" after each save, plus the sync button | Same as TVM |
| Photos | System camera (`TakePicture`) and photo picker, compressed to JPEG in app storage until sent | No CameraX; works offline |
| GPS | `LocationManagerCompat` with timeout and accuracy warning | Same as TVM; no Google Play Services needed |
| Contacts | System contact picker intent | No contacts permission needed |
| Size | R8 minify + resource shrinking, arm64 + armv7 only | Target: release APK under 10 MB |
| Login | Existing `POST /auth/login`; token kept until logout (never expires, as today) | No backend change |

## How offline works

1. **After login (online)** the phone downloads one bundle: the user's covered villages,
   farmers and plots in those villages, and the master lists (crops, varieties, seasons,
   issue types, good things, diseases, pests, techniques). It is refreshed on every sync.
2. **Offline**, every lookup and form works from that local copy.
3. **Every save** becomes an outbox record with its own ID made on the phone (a UUID), plus
   its photos as files. The record shows "Pending sync" until the server accepts it.
4. **Sync** sends the outbox oldest first, to the **existing** endpoints (`POST /visits`,
   `POST /farmers`, ...), adding the record's `clientId`. The server stores `client_id` and,
   if it has seen that ID before, returns the record it already saved. So a retry after a
   dropped connection never creates a duplicate.
5. A farmer created offline gets its server ID on sync; visits that reference it wait until
   then.
6. **Duplicates**: if the server says the phone number belongs to another farmer, the record
   is marked "Needs attention" on the phone and flagged for an admin to review and merge
   (PRD section 10). The admin merge screen comes in phase 2.
7. **Logout** is blocked while records are unsent, with a "Log out anyway" option, as in TVM.

### Backend changes

- Migration `050_client_ids.sql`: nullable `client_id uuid unique` on farmers, demo_plots,
  visits, trainings, field_days, institution_visits, agro_dealer_visits, tfo_demos,
  tfo_home_gardens and data-collection submissions.
- Those create endpoints accept an optional `clientId` and return the existing row when it
  repeats. Behaviour for the web admin and the Expo app is unchanged.
- New `GET /sync/bundle?since=<timestamp>`: the user's scoped download, built from the same
  coverage rules (`getCoveredVillageIds`, country-scoped master lists) the app uses today.
- Later phase: `duplicate_flags` table and an admin review page.
- Automated tests for each change.

## Phases

Each phase ends with a working APK you can install, tests for its rules, and a plain-language
note on what to try.

| Phase | What you get |
| --- | --- |
| **0. Foundation** | Android project, theme and components from `field-app-ui`, login, home dashboard, drawer menu, sync icon, profile/logout. APK size checked. |
| **1. Offline lookup and visits** | Bundle download; Farmers list/search/lookup by phone; farmer profile; one **Demos** list and demo detail; **Log Visit** with photos, issues, good things, diseases, pests and GPS, fully offline; visit history; outbox + auto-sync. Backend: `client_id` migration, `clientId` on `/visits`, `/sync/bundle`. |
| 2. Farmers and demos offline | Create farmer (simple and detailed), edit, deactivate, create a demo linked to a farmer, all offline; duplicate flagging + admin review page on the web. |
| 3. Activities | Trainings, field days, institution and agro-dealer visits, data-collection forms, offline. |
| 4. TFO demos and home gardens | Create/edit demos and home gardens, crop detail, business plan (expected cost/return), actual cost/return, status changes: the KT-style demo screens. |
| 5. Issues and notifications | Issue lists and detail with actions (queued offline), bulk verify, notifications. Reassignment pickers need internet. |
| 6. Release | Signed release APK, update path, field test with 2-3 staff, retire the Expo app. |

Sign-up stays online-only (it needs an admin's approval anyway).

**Demos are one concept (decision 2026-11-23).** There is no separate
"Adoption Plots" area. Every demo is linked to a farmer and has a required
**Demo Type** field: *Demo Plot* or *Adoption Plot* (stored in the existing
`demo_plots.plot_type` column, so no migration is needed). The app shows one
Demos list with the Demo Type on each card; the create-demo form (phase 2)
asks for it. The only behaviour that still depends on the type is the visit
form's "Techniques adopted" list, which the server accepts for Adoption Plots only.

**Phase 1 is done when:** with the phone in airplane mode, a user can find a farmer by phone,
open a plot and log a visit with a photo; it syncs once the phone is back online; and the
release APK is under 10 MB.

## Decisions needed before coding

1. **App ID.** Keep `com.fieldmonitoring.app` (same as the Expo app). Because the signing key
   differs, testers uninstall the Expo app once before installing the new one.
2. **Logo.** The design uses an organisation logo in the top bar. Which file should it be
   (for example the East-West Seed Knowledge Transfer logo)?
3. **Gradle download.** The build needs Gradle 9.8.1 from `services.gradle.org` (about
   150 MB, downloaded once by the Gradle wrapper).
