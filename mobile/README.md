# Mobile (Expo)

React Native app skeleton, built with Expo. Android-first per the PRD (iOS out of scope for Phase 1).

## Run it (Phase 0 — local, on your own phone)

1. Install the **Expo Go** app on your Android phone (Play Store).
2. Make sure your phone and laptop are on the same WiFi network.
3. From this folder:

   ```bash
   npm install
   npm start
   ```

4. Scan the QR code shown in the terminal with Expo Go.

## Connecting to the backend

The backend (see `../backend`) runs on your laptop at `http://localhost:4000`. From a physical phone on the same WiFi, `localhost` refers to the *phone*, not your laptop — use your laptop's LAN IP instead (e.g. `http://192.168.1.23:4000`). Find it with `ipconfig` (look for the WiFi adapter's IPv4 address).

A good next step once the backend is reachable: add an API base URL config (e.g. an `.env` read via `expo-constants` or `app.config.js`) so this doesn't need to be hardcoded.

## Generating a local APK later

Once core workflows are validated against Expo Go, an installable APK can be produced without a full local Android SDK setup via [EAS Build](https://docs.expo.dev/build/introduction/)'s free tier (`npx eas build -p android --profile preview`).
