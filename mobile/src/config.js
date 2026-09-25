// Where the app finds the backend. Set EXPO_PUBLIC_API_URL in mobile/.env to
// the hosted address (e.g. https://field-monitoring.onrender.com, no trailing
// slash). The fallback is your laptop's LAN IP for local development - if it
// stops connecting after switching networks, re-run `ipconfig` on the laptop
// and update it.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.2:4000';
