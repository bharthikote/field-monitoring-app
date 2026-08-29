# Field Monitoring & Issue Management System

Custom mobile app + web admin platform for field monitoring across 11 countries. See [PRD_Field_Monitoring_System.md](PRD_Field_Monitoring_System.md) for full requirements.

## Repo layout

```
backend/   Node.js API server, connects to Supabase Postgres
mobile/    React Native (Expo) app for Team Lead / Supervisor / Country Manager / TFO
```

## Phase 0 — local development

Per PRD Section 14: everything runs locally against a free-tier Supabase Postgres instance before any hosting or Play Store setup.

- Backend runs on the developer's laptop, connects to Supabase over the internet.
- Mobile app is tested via Expo Go (or a locally-generated APK) on a phone on the same WiFi as the laptop.

## Setup

See `backend/README.md` and `mobile/README.md` for service-specific setup steps.
