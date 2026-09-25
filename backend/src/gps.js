// Reads optional gpsLat/gpsLng/gpsAccuracy from a request body (JSON or
// multipart strings). Returns { lat, lng, accuracy } (all null when absent),
// or { error } when a value is present but not a real coordinate.
export function parseGps(body) {
  const { gpsLat, gpsLng, gpsAccuracy } = body || {};
  const blank = (v) => v === undefined || v === null || v === '';
  if (blank(gpsLat) && blank(gpsLng)) return { lat: null, lng: null, accuracy: null };

  const lat = Number(gpsLat);
  const lng = Number(gpsLng);
  if (blank(gpsLat) || blank(gpsLng) || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'gpsLat and gpsLng must be valid coordinates' };
  }
  const accuracy = blank(gpsAccuracy) ? null : Number(gpsAccuracy);
  return { lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null };
}
