// Shared option lists reused across TFO activity forms (Demo Plot, Home
// Garden, ...) so a value like "Sprinkler" or "Loamy" always means the same
// underlying id everywhere it's used - each is fed into SearchableSelect,
// not a bespoke component, since SearchableSelect is already the app's one
// generic selector.
export const IRRIGATION_SYSTEMS = [
  { id: 'hand_watering', name: 'Hand Watering' }, { id: 'drip_irrigation', name: 'Drip Irrigation' },
  { id: 'sprinkler', name: 'Sprinkler' }, { id: 'rainfed', name: 'Rain-fed' },
];

// "Soil Type" - used identically by both Demo Plot and Home Garden.
export const SOIL_TYPES = [
  { id: 'sandy', name: 'Sandy' }, { id: 'sandy_loam', name: 'Sandy Loam' },
  { id: 'loamy', name: 'Loamy' }, { id: 'clay', name: 'Clay' },
];
