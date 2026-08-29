# Product Requirements Document
## Custom Field Monitoring & Issue Management System

**Status:** Draft v2 — living document, refine as the build progresses
**Owner / Super Admin:** Bharath Kumar
**Countries:** 11
**Build approach:** Phased, ~6 months, via Claude Code, non-technical founder as product owner

---

## 1. Background & Purpose

The organization currently monitors demo plots across 11 countries using KoboToolbox. This works reasonably well for basic monitoring but has core limitations:

1. **No native issue-tracking workflow** — field issues can't be assigned, escalated, or verified within Kobo.
2. **Demo plot master data is manually maintained** — plot lists are queried from a vendor database and re-uploaded to Kobo weekly.
3. **No role-differentiated data capture** — Supervisors need deeper agronomic data than Team Leads, which Kobo's single-form structure doesn't support well.

This system is a custom mobile app + web admin platform, built specifically for the **technical/supervisory side** of field monitoring: Team Lead, Supervisor, Country Manager, Admin, Super Admin, and Leadership.

**Relationship to the existing vendor app:** Extension Agents (TFOs) continue using the existing vendor-built app for farmer registration, demo/adoption plot setup, home gardens, and training/field day logging. This new system is being built **fully independently**, with no data sync or integration to the vendor system. If it proves out, TFO-side functionality may be absorbed into this system later — that decision is deferred.

---

## 2. Roles & Permissions

| Role | Scope / Visibility | Capabilities |
|---|---|---|
| **Extension Agent (TFO)** | Own assigned issues only | Log in, view assigned issues, work on and resolve them. No other functionality in this system (Phase 1). |
| **Supervisor** | Own assigned TFOs / villages | Detailed agronomic visit form; raise & assign issues to TFOs; verify TFO-resolved issues before closing. |
| **Team Lead** | Own state | Light visit form; raise & assign issues to Supervisors (immediately or held for later). |
| **Country Manager** *(formerly "TSH")* | Own country | Same light visit form as Team Lead; raise & assign issues to Team Leads or Supervisors. |
| **Admin** | Own country | Approves new user registrations; manages District/Block/Village; assigns users to villages/districts within their country; cannot rename location labels or create Country/State. |
| **Super Admin** (Bharath) | All countries | Full control — creates Country/State, renames location labels per country, manages all global master data lists, creates user accounts directly, can override any role assignment. |
| **Leadership** | All countries | View/reporting access only. Cannot approve users, modify data, or change any configuration. |

---

## 3. User Onboarding & Authentication

**Two ways to create an account:**
1. **Self-registration** (mobile app) — any person can download the app, sign up, and select their role. Account remains inactive until the relevant country's **Admin approves it**.
2. **Direct creation** (web app, Super Admin only) — Super Admin creates the account and shares the username directly. No verification step required, since Super Admin creating the account is itself the trust signal.

**Verification (self-registration only):** Mobile OTP or Email OTP/verification link — user's choice.

**Login:** Username (mobile number or email) + password. Sign-up and login both require internet connectivity.

**Password reset:** Available anytime via OTP or email, for any account (including Super Admin-created ones).

**Session policy:** No session expiry. Once logged in, a user stays logged in indefinitely until manual logout — critical given offline/low-connectivity field conditions.

**Role changes:** Admin (within their country) or Super Admin can modify a user's assigned role after creation.

---

## 4. Location Hierarchy

Fixed 5-level structure, applied uniformly across all 11 countries:

**Country → State → District → Block → Village**

| Level | Created/modified by |
|---|---|
| Country, State | Super Admin only |
| District, Block, Village | Admin (scoped to their own country) |
| Level labels (e.g. renaming "State" for local context) | Super Admin only, configurable **per country** |

**User-to-location assignment:**
- Super Admin assigns a user's Country/State-level scope.
- Admin assigns a user's District/Block/Village-level scope, within their own country.

A user's assigned location(s) determine what demo plot and farmer data is visible/downloaded to their device (see Section 8, Offline Handling).

---

## 5. Farmer & Demo Plot Data Model

Demo plot data is created and maintained entirely within this system — no import or sync from any external source, including the vendor app.

**Key identifier:** Farmer's phone number.

**Visit flow:**
1. User (any role — Team Lead, Supervisor, Country Manager, Admin) enters the farmer's phone number.
2. **If the number is new:** user creates a new demo plot record with: Farmer Name, Crop, Variety, Village, Phone Number, Demo Status (Ongoing / Completed / Terminated).
3. **If the number already exists:** the app shows all demo plots already linked to that phone number. The user selects the relevant one to continue monitoring, log a visit, or raise an issue.

**Rules:**
- One farmer (one phone number) can have **multiple demo plots** (e.g. different crops).
- There is no single "owner" of a demo plot record — any authorized role can be the first to create it or a later user continuing to monitor it.
- Crop and Variety are selected from the Super Admin-maintained master list (see Section 7).

---

## 6. Visit Forms

Two form types:

| Form | Used by | Content |
|---|---|---|
| **Light monitoring form** | Team Lead, Country Manager | Equivalent to current Kobo-level data capture. |
| **Detailed agronomic form** | Supervisor | Everything in the light form, **plus**: <br>• Disease identification (from master list) + control recommendation (pick from master list **or** free text if not covered) <br>• Pest identification (from master list) + control recommendation (same pick-or-type pattern) <br>• A **configurable custom question bank** — see below |

**Supervisor's custom question bank:** Rather than hardcoding extra Demo Plot / Adoption Plot questions (which are not yet fully known), these are built as **configurable data**, managed by Super Admin:
- Super Admin creates a question (e.g. "How is the raised bed?", "How is the trellising?", "How is weeding/watering?", "Nursery setup condition?")
- Super Admin defines the answer type per question — single-select or multi-select — and the specific answer options for that question
- Super Admin assigns which countries each question applies to (local agronomic context varies)
- The Supervisor's form dynamically renders whatever questions are enabled for their country — **no app update required** to add, remove, or change a question later

**Photo/evidence capture:** Mandatory throughout, consistent with the existing Kobo form's approach.

---

## 7. Master Data Lists

All of the following are **Super Admin-owned**, **enabled per country**, and support **bulk upload**:

| Master list | Notes |
|---|---|
| Crop | |
| Variety | Uniqueness scoped **per crop** — the same variety name can exist under two different crops without conflict. |
| Training topics | |
| Field Day topics | Multiple topics can be selected per session (multi-select). |
| Issue types | Selected from list only when raising an issue — no free text. Seed data: 28 existing types from current Kobo form. |
| Disease | Seed data: 22 existing types from current Kobo form. |
| Pest | Seed data: 16 existing types from current Kobo form. |
| Technique / Recommendation | Paired with disease/pest identification. Seed data: 24 existing entries from current Kobo form. |
| Good Things Observed | Seed data: 27 existing entries from current Kobo form. |

**Bulk upload mechanism** (applies to all lists above, and to Location — District/Block/Village):
1. A pre-designed Excel **template is downloadable directly from the same screen** where the bulk upload happens (no separate template repository).
2. Super Admin fills the template and uploads it from that same screen.
3. **Duplicate/invalid rows are skipped, not rejected outright** — valid rows are imported, and a **report is shown listing which rows were skipped and why** (e.g. "already exists").
4. Manual single-entry add/edit is also always available as an alternative to bulk upload.

**Access restriction:** Bulk upload is Super Admin only, across all master lists.

---

## 8. Issue Management Lifecycle

**Who can raise issues, and to whom:**
- Country Manager → Team Lead or Supervisor
- Team Lead → Supervisor (immediately, or held and delegated later)
- Supervisor → TFO

**Status flow:**

```
Raised → Assigned → In Progress → Marked Resolved (by assignee)
      → Pending Verification → Verified/Closed (by assigner)
```

- If the assigner rejects the resolution during verification, the issue **reopens** and returns to the assignee.
- **Closure responsibility:** For Supervisor → TFO issues, the TFO can mark an issue resolved, but the **Supervisor must verify it before it is truly closed** — TFO's mark-as-resolved is not final on its own.
- **Issue type** is selected from the Super Admin-managed master list only (Section 7) — no free-text issue description.

---

## 9. Notifications

**Push notifications trigger only for:**
1. **Assigned** — sent to whoever an issue is newly assigned to.
2. **Closed/Resolved** — flows **up the chain** whenever a subordinate closes/resolves an issue their superior needs to know about or verify (TFO closes → Supervisor notified; Supervisor closes → Team Lead notified; and so on).

**Everything else** (in progress updates, overdue issues, etc.) is passive — visible only when the user opens the app, no push notification.

**In-app indicator:** A badge icon shows the count of assigned + closed items awaiting the user's attention; the badge clears once the user views them.

**Sync completion notification:** Toggleable in app settings (see Section 10).

---

## 10. Offline Handling & Sync

Given variable connectivity across 11 countries, the mobile app is designed **offline-first** for day-to-day field use, with login/sign-up as the only steps requiring internet.

**How it works:**
- Each user's app downloads a **local copy of farmer/demo plot data scoped to their assigned villages** (not the entire country).
- Phone-number lookup, demo plot creation, visit forms, and issue actions all work **fully offline** against this local copy.
- New/changed data queues locally until connectivity returns.

**Sync:**
- **Auto-sync** triggers automatically whenever connectivity is detected.
- A **single sync button** shows a badge with the pending-item count, or a checkmark icon when fully synced. Tapping this button at any time **also forces an immediate sync attempt** — there is no separate "force sync" control.
- On completion, a toggleable notification confirms sync is done.

**Duplicate handling:**
- If two users independently create demo plot records for the same farmer phone number while offline, this is only detected at sync time.
- The system **flags the duplicate and notifies Admin**, who manually reviews and **merges** the two records.
- **All transactional data (visits, issues, photos) logged against either duplicate carries over and remains attached to the merged record** — no monitoring history is lost in a merge.

---

## 11. Web Admin Panel — Core Functions

1. Approve new user registrations (Admin, per country)
2. User management — edit roles, deactivate accounts (Admin/Super Admin)
3. Location management — District/Block/Village (Admin); Country/State and label renaming (Super Admin only)
4. Village/district-to-user assignment (Admin for District/Block/Village scope; Super Admin for Country/State scope)
5. All master data list management, including bulk upload with template + skip-and-report (Super Admin)
6. Supervisor custom question bank management, including per-country assignment (Super Admin)
7. Identity — all accounts tagged to a mobile number or email

---

## 12. Language

**English only for Phase 1** — both static app UI text and all master data content (crop names, disease names, custom questions, etc.). No translation infrastructure in this phase; can be added as a dedicated later phase once the core system is validated.

---

## 13. Out of Scope (Phase 1)

- TFO-side functionality — farmer profile creation, demo/home garden setup, training and field day logging — remains entirely in the existing vendor-built app. Not rebuilt here.
- TFO access in this system is limited to: log in → view assigned issues → resolve.
- Reporting/dashboard design — deferred until the core data model and workflows are built and validated. Role-based data access will apply once designed. Power BI is a possible path for consuming the underlying data, to be evaluated alongside in-app dashboards.
- Multi-language support.
- iOS app (Android/Play Store first).

---

## 14. Local Development & Testing Plan (Phase 0)

Before any hosting or Play Store setup, the system will be built and tested entirely locally:

- Backend (API + Postgres database) runs on the developer's laptop, or against a free-tier cloud Postgres (e.g. Supabase/Neon) to avoid local installation overhead.
- Mobile app is tested by installing a locally-generated APK directly on personal devices (same home WiFi network as the laptop).
- Additional test users (e.g. simulating Team Lead / Supervisor roles) test via a second phone on the same network.
- Cloud hosting, Play Store publishing, and SMS/Email provider setup are deferred until the core workflows are validated locally.

---

## 15. Suggested MVP Scope

Given the "build slowly, validate, iterate" approach:

1. User registration + role selection + Admin approval, and Super Admin direct account creation
2. Location hierarchy setup (Super Admin/Admin) and user-to-location assignment
3. Demo plot creation/lookup by phone number, with offline support
4. Light visit form (Team Lead / Country Manager)
5. Core issue lifecycle: raise → assign → resolve → verify → close, with the two required notification triggers
6. Basic sync with duplicate detection (merge workflow can follow shortly after)

**Deferred to later iterations:** Supervisor's detailed agronomic form and custom question bank, full master data list management (beyond seed data), Leadership reporting views, multi-language support.

---

## 16. Open Items

- Full agronomic field list for the Supervisor form beyond what's listed in Section 6 (intentionally left open, to be defined via the configurable question bank as real gaps are discovered in practice).
- Exact SMS/Email provider selection (deferred to hosting phase).
- Play Store publishing requirements (privacy policy, business verification) — to review closer to launch.
