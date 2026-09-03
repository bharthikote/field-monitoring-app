// Shared option lists reused across TFO activity forms (Demo Plot, Home
// Garden, ...) so a value like "Sprinkler" or "Loamy" always means the same
// underlying id everywhere it's used - each is fed into SearchableSelect,
// not a bespoke component, since SearchableSelect is already the app's one
// generic selector.
export const IRRIGATION_SYSTEMS = [
  { id: 'hand_watering', name: 'Hand Watering' }, { id: 'drip_irrigation', name: 'Drip Irrigation' },
  { id: 'sprinkler', name: 'Sprinkler' }, { id: 'rainfed', name: 'Rain-fed' },
];

// Demo Plot calls this "Soil Type"; Home Garden calls the same concept
// "Site/Field Condition" - same 4 options either way, just a different
// field label at the call site.
export const FIELD_CONDITIONS = [
  { id: 'sandy', name: 'Sandy' }, { id: 'sandy_loam', name: 'Sandy Loam' },
  { id: 'loamy', name: 'Loamy' }, { id: 'clay', name: 'Clay' },
];
