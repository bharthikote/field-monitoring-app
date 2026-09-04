import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createTfoDemo, updateTfoDemo, listSeasons } from '../api';
import LocationPicker from '../components/LocationPicker';
import SearchableSelect from '../components/SearchableSelect';
import CropVarietyPicker from '../components/CropVarietyPicker';
import DatePickerField from '../components/DatePickerField';
import NumberField from '../components/NumberField';
import GpsLocationField from '../components/GpsLocationField';
import { IRRIGATION_SYSTEMS, SOIL_TYPES } from '../constants/tfoFieldOptions';
import { COLORS } from '../theme';

// Cycle = which season-with-this-farmer this demo belongs to, not a crop
// season - 4 Demo rounds and 4 Adoption rounds, per the vendor app's own
// "Add Demo" screen.
const CYCLES = [
  { id: 'demo_1', name: 'Demo 1' }, { id: 'demo_2', name: 'Demo 2' },
  { id: 'demo_3', name: 'Demo 3' }, { id: 'demo_4', name: 'Demo 4' },
  { id: 'adoption_1', name: 'Adoption 1' }, { id: 'adoption_2', name: 'Adoption 2' },
  { id: 'adoption_3', name: 'Adoption 3' }, { id: 'adoption_4', name: 'Adoption 4' },
];

// `_key` is a stable React key independent of array position - removing an
// earlier crop block must not shift a later block's list index onto it,
// since CropVarietyPicker holds its own crop/variety selection internally
// (uncontrolled) and would otherwise carry that stale state into whatever
// block now lands on its old index.
let cropKeySeq = 0;
function blankCrop() {
  return {
    _key: `crop-${cropKeySeq++}`,
    cropId: null, varietyId: null, seasonId: null, cropArea: '', noOfSeeding: '',
    sowingDate: '', transplantDate: '', estHarvestDate: '', irrigationSystem: null,
    noTransplanted: '0', noHarvested: '0',
  };
}

// Maps one crop row from GET /tfo-demos/:id (snake_case, backend field
// names) into this form's internal shape - used to prefill the Edit flow.
function cropFromDemoDetail(row) {
  return {
    _key: `crop-${cropKeySeq++}`,
    cropId: row.crop_id, varietyId: row.variety_id, seasonId: row.season_id,
    cropArea: row.crop_area != null ? String(row.crop_area) : '',
    noOfSeeding: row.no_of_seeding != null ? String(row.no_of_seeding) : '',
    sowingDate: row.sowing_date || '', transplantDate: row.transplant_date || '', estHarvestDate: row.est_harvest_date || '',
    irrigationSystem: row.irrigation_system,
    noTransplanted: row.no_transplanted != null ? String(row.no_transplanted) : '',
    noHarvested: row.no_harvested != null ? String(row.no_harvested) : '',
  };
}

// One repeatable "Crop Details" block. Fully controlled - `crop` and
// `onChange(patch)` - so the parent screen owns the array and can add/
// remove blocks freely. `crop.cropId`/`crop.varietyId` only ever seed
// CropVarietyPicker's *initial* selection (see that component) - after
// that it's the one driving cropId/varietyId via onChange, same as always.
function CropDetailBlock({ token, index, crop, seasons, onChange, onRemove }) {
  return (
    <View style={styles.cropBlock}>
      <View style={styles.cropBlockHeader}>
        <Text style={styles.sectionHeader}>Crop Details - {index + 1}</Text>
        {onRemove && (
          <Pressable onPress={onRemove}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        )}
      </View>

      {/* Bundle 1 - Crop / Timeline Details */}
      <CropVarietyPicker
        token={token}
        initialCropId={crop.cropId}
        initialVarietyId={crop.varietyId}
        onChange={({ cropId, varietyId }) => onChange({ cropId, varietyId })}
      />

      <SearchableSelect
        label="Season *"
        placeholder="-- select season --"
        options={seasons}
        value={crop.seasonId}
        onChange={(seasonId) => onChange({ seasonId })}
      />

      <NumberField label="Crop Area *" value={crop.cropArea} onChangeText={(v) => onChange({ cropArea: v })} suffix="m²" />

      <DatePickerField label="Sowing Date *" value={crop.sowingDate} onChange={(v) => onChange({ sowingDate: v })} />
      <DatePickerField label="Transplant Date *" value={crop.transplantDate} onChange={(v) => onChange({ transplantDate: v })} />
      <DatePickerField label="Est. Harvest Date *" value={crop.estHarvestDate} onChange={(v) => onChange({ estHarvestDate: v })} />

      <SearchableSelect
        label="Irrigation System *"
        placeholder="-- select option --"
        options={IRRIGATION_SYSTEMS}
        value={crop.irrigationSystem}
        onChange={(v) => onChange({ irrigationSystem: v })}
      />

      {/* Bundle 2 - Demo / Planting Details */}
      <Text style={styles.subSectionLabel}>Demo / Planting Details</Text>
      <NumberField label="No. of Seeding *" value={crop.noOfSeeding} onChangeText={(v) => onChange({ noOfSeeding: v })} />
      <NumberField label="No. Transplanted" value={crop.noTransplanted} onChangeText={(v) => onChange({ noTransplanted: v })} />
      <NumberField label="No. Harvested" value={crop.noHarvested} onChangeText={(v) => onChange({ noHarvested: v })} />
    </View>
  );
}

// `farmer` is picked before this screen is ever reached (see App.js's
// tfo-select-farmer-for-demo step, or a Farmer Profile's Create Demo
// button) - village and farmer are both locked summaries of that choice,
// not editable here.
//
// `demo` (optional) is the { demo, crops } payload from GET /tfo-demos/:id -
// when present, this is the Edit flow: every field prefills from it and
// Save calls PATCH instead of POST. Same form either way, per the "reuse
// the Demo Creation form for editing" requirement - no second component.
export default function CreateTfoDemoScreen({ token, farmer, demo, onBack, onCreated }) {
  const isEditing = !!demo;
  const [gpsLat, setGpsLat] = useState(demo ? String(demo.demo.gps_lat) : '');
  const [gpsLng, setGpsLng] = useState(demo ? String(demo.demo.gps_lng) : '');
  const [villageId, setVillageId] = useState(farmer.village_id);
  const [cycle, setCycle] = useState(demo?.demo.cycle || null);
  const [ownArea, setOwnArea] = useState(demo ? String(demo.demo.own_area) : '');
  const [rentArea, setRentArea] = useState(demo ? String(demo.demo.rent_area) : '');
  const [soilPh, setSoilPh] = useState(demo ? String(demo.demo.soil_ph) : '');
  const [soilType, setSoilType] = useState(demo?.demo.soil_type || null);
  const [crops, setCrops] = useState(() => (demo?.crops?.length ? demo.crops.map(cropFromDemoDetail) : [blankCrop()]));
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listSeasons(token, farmer.country_id).then((data) => setSeasons(data.items)).catch(() => {});
  }, [token, farmer.country_id]);

  // Total Demo Size = sum of every crop's own Area field (not own/rent land
  // size) - read-only, recalculated on every render as crop areas change.
  const totalDemoSize = Math.round(crops.reduce((sum, c) => sum + (Number(c.cropArea) || 0), 0) * 100) / 100;

  const lockedVillage = {
    id: farmer.village_id, name: farmer.village_name, block_name: farmer.block_name,
    district_name: farmer.district_name, state_name: farmer.state_name, country_name: farmer.country_name,
  };

  const updateCrop = (index, patch) => {
    setCrops((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCrop = (index) => {
    setCrops((prev) => prev.filter((_, i) => i !== index));
  };

  // Mirrors the backend's own validation (tfoDemos.js) so mistakes surface
  // immediately instead of round-tripping to the server first.
  const validate = () => {
    if (!gpsLat || !gpsLng) return 'Please capture the GPS location.';
    if (!cycle) return 'Please select a cycle.';
    if (ownArea === '' || Number(ownArea) < 0) return 'Please enter the own land area.';
    if (rentArea === '' || Number(rentArea) < 0) return 'Please enter the rented land area.';
    const ph = Number(soilPh);
    if (soilPh === '' || Number.isNaN(ph) || ph < 0 || ph > 14) return 'Soil pH must be a number between 0 and 14.';
    if (!soilType) return 'Please select a soil type.';

    for (let i = 0; i < crops.length; i++) {
      const c = crops[i];
      const label = `Crop ${i + 1}`;
      if (!c.cropId || !c.varietyId || !c.seasonId) return `${label}: crop, variety, and season are all required.`;
      if (c.cropArea === '' || Number(c.cropArea) < 0) return `${label}: crop area is required.`;
      if (c.noOfSeeding === '' || !Number.isInteger(Number(c.noOfSeeding)) || Number(c.noOfSeeding) < 0) {
        return `${label}: number of seeding is required.`;
      }
      if (!c.sowingDate || !c.transplantDate || !c.estHarvestDate) return `${label}: sowing, transplant, and estimated harvest dates are all required.`;
      if (!(c.sowingDate <= c.transplantDate && c.transplantDate <= c.estHarvestDate)) {
        return `${label}: dates must run sowing → transplant → estimated harvest, in that order.`;
      }
      if (!c.irrigationSystem) return `${label}: please select an irrigation system.`;

      const seeding = Number(c.noOfSeeding);
      const transplanted = c.noTransplanted === '' ? null : Number(c.noTransplanted);
      const harvested = c.noHarvested === '' ? null : Number(c.noHarvested);
      if (transplanted !== null && transplanted > seeding) return `${label}: number transplanted can't be more than number of seeding.`;
      if (harvested !== null && transplanted !== null && harvested > transplanted) return `${label}: number harvested can't be more than number transplanted.`;
      if (harvested !== null && transplanted === null) return `${label}: number harvested needs a number transplanted first.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        farmerId: farmer.id,
        villageId,
        gpsLat,
        gpsLng,
        cycle,
        ownArea,
        rentArea,
        soilPh,
        soilType,
        crops: crops.map(({ _key, ...c }) => ({
          ...c,
          noTransplanted: c.noTransplanted === '' ? null : c.noTransplanted,
          noHarvested: c.noHarvested === '' ? null : c.noHarvested,
        })),
      };
      if (isEditing) {
        await updateTfoDemo(token, demo.demo.id, payload);
      } else {
        await createTfoDemo(token, payload);
      }
      Alert.alert('Demo saved', '', [{ text: 'OK', onPress: onCreated }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? 'Edit Demo' : 'Add Demo'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <GpsLocationField
          lat={gpsLat}
          lng={gpsLng}
          onChange={({ lat, lng }) => { setGpsLat(lat); setGpsLng(lng); }}
          onError={setError}
        />

        <LocationPicker token={token} onVillageChange={setVillageId} lockedVillage={lockedVillage} />

        <SearchableSelect label="Farmer *" options={[{ id: farmer.id, name: farmer.name }]} value={farmer.id} onChange={() => {}} disabled />

        <SearchableSelect label="Cycle *" placeholder="-- select option --" options={CYCLES} value={cycle} onChange={setCycle} />

        <View style={styles.divider} />
        <Text style={styles.sectionHeader}>Size of Demo</Text>

        <NumberField label="Own *" value={ownArea} onChangeText={setOwnArea} suffix="m²" />
        <NumberField label="Rent *" value={rentArea} onChangeText={setRentArea} suffix="m²" />

        <NumberField label="Soil pH *" value={soilPh} onChangeText={setSoilPh} />
        <SearchableSelect label="Soil Type *" placeholder="-- select option --" options={SOIL_TYPES} value={soilType} onChange={setSoilType} />

        <View style={styles.divider} />

        {crops.map((crop, index) => (
          <CropDetailBlock
            key={crop._key}
            token={token}
            index={index}
            crop={crop}
            seasons={seasons}
            onChange={(patch) => updateCrop(index, patch)}
            onRemove={crops.length > 1 ? () => removeCrop(index) : null}
          />
        ))}

        <Text style={styles.label}>Total Demo Size</Text>
        <View style={styles.totalAreaBox}>
          <Text style={styles.totalAreaText}>{totalDemoSize}</Text>
          <Text style={styles.suffixTextStatic}>m²</Text>
        </View>

        <Pressable style={styles.addAnotherButton} onPress={() => setCrops((prev) => [...prev, blankCrop()])}>
          <Text style={styles.addAnotherText}>Add another</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable style={styles.saveButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onBack} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  container: { padding: 24, paddingBottom: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  suffixTextStatic: { color: COLORS.textMuted, fontSize: 13 },
  totalAreaBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#e6e4de', backgroundColor: COLORS.bg, borderRadius: 8, padding: 12,
  },
  totalAreaText: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark },
  divider: { height: 1, backgroundColor: '#e6e4de', marginVertical: 20 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  subSectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.primaryDark, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 4,
  },
  cropBlock: { marginTop: 8 },
  cropBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  removeText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  addAnotherButton: {
    backgroundColor: COLORS.primaryDark, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20,
  },
  addAnotherText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  error: { color: COLORS.danger, marginBottom: 12 },
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#e6e4de', backgroundColor: '#fff',
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  saveButton: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancelButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.danger,
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  cancelButtonText: { color: COLORS.danger, fontWeight: '600', fontSize: 16 },
});
