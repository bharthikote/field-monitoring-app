import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

const FRESH_MS = 2 * 60 * 1000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// One-shot fix as { lat, lng, accuracy, at }. Throws an Error whose message is
// safe to show the user. A phone indoors can take a long time to lock, so a
// slow high-accuracy read falls back to the last position the OS knows about
// (up to 5 minutes old) rather than failing outright.
export async function getGpsFix() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is off. Allow location for this app in your phone settings.');
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Your phone's location (GPS) is switched off. Turn it on and try again.");
  }

  let pos = null;
  try {
    pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 20000);
  } catch {
    pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null);
  }
  if (!pos) throw new Error('Could not get a GPS fix. Move to an open area and try again.');
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    at: Date.now(),
  };
}

// Straight-line metres between two { lat, lng } points (Haversine).
export function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function appendGps(form, fix) {
  if (!fix) return;
  form.append('gpsLat', String(fix.lat));
  form.append('gpsLng', String(fix.lng));
  if (fix.accuracy != null) form.append('gpsAccuracy', String(fix.accuracy));
}

export function gpsPayload(fix) {
  return fix ? { gpsLat: fix.lat, gpsLng: fix.lng, gpsAccuracy: fix.accuracy ?? undefined } : {};
}

// Captures a fix as soon as the screen opens, so it's already there by the
// time the form is filled in. `getForSubmit()` re-reads if that fix has gone
// stale (the user may have walked a while) and falls back to the older one if
// the re-read fails, so a flaky signal never blocks a submit on its own.
export function useGps() {
  const [fix, setFix] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const fixRef = useRef(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setMessage('');
    try {
      const next = await getGpsFix();
      fixRef.current = next;
      if (mounted.current) { setFix(next); setStatus('ok'); }
      return next;
    } catch (err) {
      if (mounted.current) {
        setStatus(fixRef.current ? 'ok' : 'error');
        setMessage(err.message);
      }
      return fixRef.current;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  const getForSubmit = useCallback(async () => {
    const current = fixRef.current;
    if (current && Date.now() - current.at < FRESH_MS) return current;
    return refresh();
  }, [refresh]);

  return { fix, status, message, refresh, getForSubmit };
}
