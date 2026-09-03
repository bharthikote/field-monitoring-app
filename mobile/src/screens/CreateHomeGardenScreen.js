import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createTfoHomeGarden } from '../api';
import LocationPicker from '../components/LocationPicker';
import SearchableSelect from '../components/SearchableSelect';
import CropVarietyPicker from '../components/CropVarietyPicker';
import DatePickerField from '../components/DatePickerField';
import NumberField from '../components/NumberField';
import GpsLocationField from '../components/GpsLocationField';
import { IRRIGATION_SYSTEMS, FIELD_CONDITIONS } from '../constants/tfoFieldOptions';
import { COLORS } from '../theme';

// Same architecture as CreateTfoDemoScreen.js (Farmer/Village/GPS/Cycle,
// then a site-details section, then repeatable Crop Details blocks), just
// with Home Garden's own cycle/site fields - see tfoFieldOptions.js for
// what's shared vs configured separately between the two activities.
const CYCLES = [
  { id: 'demo_1', name: 'Demo 1' },
  { id: 'homegarden_1', name: 'Home Garden 1' }, { id: 'homegarden_2', name: 'Home Garden 2' }, { id: 'homegarden_3', name: 'Home Garden 3' },
  { id: 'adoption_1', name: 'Adoption 1' }, { id: 'adoption_2', name: 'Adoption 2' },
  { id: 'adoption_3', name: 'Adoption 3' }, { id: 'adoption_4', name: 'Adoption 4' },
];
const LAND_TYPES = [
  { id: 'own', name: 'Own Area' }, { id: 'lease_rented', name: 'Lease / Rented' },
];
const YES_NO = [
  { id: 'yes', name: 'Yes' }, { id: 'no', name: 'No' },
];

let cropKeySeq = 0;
function blankCrop() {
  return {
    _key: `hg-crop-${cropKeySeq++}`,
    cropId: null, varietyId: null, noOfSeedlings: '',
    sowingDate: '', transplantDate: '', harvestDate: '',
    containerNumber: '', plantNumber: '',
  };
}

// One repeatable "Crop Details" block - same _key/onChange/onRemove
// pattern as CreateTfoDemoScreen's CropDetailBlock, but a simpler field
// set (no season/area/irrigation/counts - those live at the site level or
// don't apply to a Home Garden).
function CropDetailBlock({ token, index, crop, onChange, onRemove }) {
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

      <CropVarietyPicker token={token} onChange={({ cropId, varietyId }) => onChange({ cropId, varietyId })} />

      <NumberField label="Number of Seedlings *" value={crop.noOfSeedlings} onChangeText={(v) => onChange({ noOfSeedlings: v })} />

      <DatePickerField label="Sowing Date *" value={crop.sowingDate} onChange={(v) => onChange({ sowingDate: v })} />
      <DatePickerField label="Transplanting Date *" value={crop.transplantDate} onChange={(v) => onChange({ transplantDate: v })} />
      <DatePickerField label="Harvesting Date *" value={crop.harvestDate} onChange={(v) => onChange({ harvestDate: v })} />

      <Text style={styles.label}>Container Number</Text>
      <TextInput style={styles.input} value={crop.containerNumber} onChangeText={(v) => onChange({ containerNumber: v })} placeholder="Optional" />

      <Text style={styles.label}>Plant Number</Text>
      <TextInput style={styles.input} value={crop.plantNumber} onChangeText={(v) => onChange({ plantNumber: v })} placeholder="Optional" />
    </View>
  );
}

// `farmer` is picked before this screen is ever reached (Home Gardens list
// -> farmer picker, or a Farmer Profile's own Create Home Garden button) -
// village and farmer are both locked summaries of that choice, not
// editable here. Mirrors CreateTfoDemoScreen.js exactly.
export default function CreateHomeGardenScreen({ token, farmer, onBack, onCreated }) {
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');
  const [villageId, setVillageId] = useState(farmer.village_id);
  const [cycle, setCycle] = useState(null);
  const [area, setArea] = useState('');
  const [landType, setLandType] = useState(null);
  const [compost, setCompost] = useState(null);
  const [irrigationSystem, setIrrigationSystem] = useState(null);
  const [fieldCondition, setFieldCondition] = useState(null);
  const [siteId, setSiteId] = useState('');
  const [crops, setCrops] = useState([blankCrop()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Mirrors the backend's own validation (tfoHomeGardens.js).
  const validate = () => {
    if (!gpsLat || !gpsLng) return 'Please capture the GPS location.';
    if (!cycle) return 'Please select a cycle.';
    if (area === '' || Number(area) < 0) return 'Please enter the area.';
    if (!landType) return 'Please select whether this is own or leased/rented land.';
    if (!compost) return 'Please select whether compost is used.';
    if (!irrigationSystem) return 'Please select an irrigation system.';
    if (!fieldCondition) return 'Please select the site/field condition.';
    if (!siteId.trim()) return 'Please enter the Site ID.';

    for (let i = 0; i < crops.length; i++) {
      const c = crops[i];
      const label = `Crop ${i + 1}`;
      if (!c.cropId || !c.varietyId) return `${label}: crop and variety are required.`;
      if (c.noOfSeedlings === '' || !Number.isInteger(Number(c.noOfSeedlings)) || Number(c.noOfSeedlings) < 0) {
        return `${label}: number of seedlings is required.`;
      }
      if (!c.sowingDate || !c.transplantDate || !c.harvestDate) {
        return `${label}: sowing, transplanting, and harvesting dates are all required.`;
      }
      if (!(c.sowingDate <= c.transplantDate && c.transplantDate <= c.harvestDate)) {
        return `${label}: dates must run sowing → transplanting → harvesting, in that order.`;
      }
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
      await createTfoHomeGarden(token, {
        farmerId: farmer.id,
        villageId,
        gpsLat,
        gpsLng,
        cycle,
        area,
        landType,
        compost: compost === 'yes',
        irrigationSystem,
        fieldCondition,
        siteId: siteId.trim(),
        crops: crops.map(({ _key, ...c }) => ({
          ...c,
          containerNumber: c.containerNumber.trim() || null,
          plantNumber: c.plantNumber.trim() || null,
        })),
      });
      Alert.alert('Home Garden saved', '', [{ text: 'OK', onPress: onCreated }]);
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
        <Text style={styles.title}>Add Home Garden</Text>
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

        <SearchableSelect label="Cycle 1 *" placeholder="-- select option --" options={CYCLES} value={cycle} onChange={setCycle} />

        <View style={styles.divider} />
        <Text style={styles.sectionHeader}>Site Details</Text>

        <NumberField label="Area *" value={area} onChangeText={setArea} suffix="m²" />
        <SearchableSelect label="Own / Lease / Rented *" placeholder="-- select option --" options={LAND_TYPES} value={landType} onChange={setLandType} />
        <SearchableSelect label="Compost *" placeholder="-- select option --" options={YES_NO} value={compost} onChange={setCompost} />
        <SearchableSelect label="Irrigation *" placeholder="-- select option --" options={IRRIGATION_SYSTEMS} value={irrigationSystem} onChange={setIrrigationSystem} />
        <SearchableSelect label="Site / Field Condition *" placeholder="-- select option --" options={FIELD_CONDITIONS} value={fieldCondition} onChange={setFieldCondition} />

        <Text style={styles.label}>Site ID *</Text>
        <TextInput style={styles.input} value={siteId} onChangeText={setSiteId} />

        <View style={styles.divider} />

        {crops.map((crop, index) => (
          <CropDetailBlock
            key={crop._key}
            token={token}
            index={index}
            crop={crop}
            onChange={(patch) => updateCrop(index, patch)}
            onRemove={crops.length > 1 ? () => removeCrop(index) : null}
          />
        ))}

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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#e6e4de', marginVertical: 20 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
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
