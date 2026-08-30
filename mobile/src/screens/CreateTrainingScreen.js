import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createTraining, getFarmerByPhone } from '../api';
import LocationPicker from '../components/LocationPicker';
import RatingSelect from '../components/RatingSelect';
import { pickPhoto, assetToFormFile } from '../photo';
import { COLORS } from '../theme';

const TRAINING_TYPES = [
  { value: 'classroom', label: 'Classroom / Theory' },
  { value: 'field_based', label: 'Field-Based / Practical' },
  { value: 'mixed', label: 'Mixed (Both)' },
];
const MAT_USED_OPTIONS = [
  { value: 'ext_material_only', label: 'Extension Material Only' },
  { value: 'training_material_only', label: 'Training Material Only' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
];
const GENDER_INTERACTIONS = [
  { value: 'both_interacted', label: 'Both Interacted' },
  { value: 'only_male', label: 'Only Male' },
  { value: 'only_female', label: 'Only Female' },
  { value: 'no_interaction', label: 'No Interaction' },
];
const SEATING_OPTIONS = [
  { value: 'equal', label: 'Equal / No Issues' },
  { value: 'discriminatory', label: 'Discrimination Observed' },
];

const PHONE_LIKE = /^\d{6,}$/;
const PLOT_TYPE_LABELS = { demo: 'Demo', adoption: 'Adoption' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };

export default function CreateTrainingScreen({ token, onBack, onCreated }) {
  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState('');
  const [villageId, setVillageId] = useState(null);
  const [existingFarmer, setExistingFarmer] = useState(null);
  const [existingPlots, setExistingPlots] = useState([]);

  const [trainingType, setTrainingType] = useState(TRAINING_TYPES[0].value);
  const [extMaterialUsed, setExtMaterialUsed] = useState(MAT_USED_OPTIONS[0].value);
  const [interactionQuality, setInteractionQuality] = useState(null);
  const [genderInteraction, setGenderInteraction] = useState(GENDER_INTERACTIONS[0].value);
  const [seating, setSeating] = useState(SEATING_OPTIONS[0].value);
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Same "this phone already belongs to a registered farmer" lookup as
  // Demo Plot's create form - Training doesn't require an existing plot,
  // but if the farmer is registered (via a plot or the Farmers tab), reuse
  // their name and lock their village.
  useEffect(() => {
    const trimmed = phone.trim();
    if (!PHONE_LIKE.test(trimmed)) {
      setExistingFarmer(null);
      setExistingPlots([]);
      return undefined;
    }
    const timeout = setTimeout(() => {
      getFarmerByPhone(token, trimmed)
        .then((data) => {
          setExistingFarmer(data.farmer);
          setExistingPlots(data.demoPlots);
          if (data.farmer) {
            setFarmerName((prev) => (prev.trim() ? prev : data.farmer.name));
          }
        })
        .catch(() => {
          setExistingFarmer(null);
          setExistingPlots([]);
        });
    }, 400);
    return () => clearTimeout(timeout);
  }, [phone, token]);

  const lockedVillage = existingFarmer ? {
    id: existingFarmer.village_id,
    name: existingFarmer.village_name,
    block_name: existingFarmer.block_name,
    district_name: existingFarmer.district_name,
    state_name: existingFarmer.state_name,
    country_name: existingFarmer.country_name,
  } : null;

  const handleSubmit = async () => {
    if (!farmerName || !phone || !villageId || !interactionQuality || !photo) {
      setError('Please fill in farmer name, phone, village, interaction quality, and add a photo.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('farmerName', farmerName);
      form.append('phone', phone);
      form.append('villageId', villageId);
      form.append('trainingType', trainingType);
      form.append('extMaterialUsed', extMaterialUsed);
      form.append('interactionQuality', String(interactionQuality));
      form.append('genderInteraction', genderInteraction);
      form.append('seating', seating);
      form.append('remarks', remarks);
      form.append('photo', assetToFormFile(photo));

      await createTraining(token, form);
      Alert.alert('Training logged', '', [{ text: 'OK', onPress: onCreated }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Log Training</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Farmer Name</Text>
      <TextInput style={styles.input} value={farmerName} onChangeText={setFarmerName} />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      {existingFarmer && (
        <View style={styles.existingBanner}>
          <Text style={styles.existingBannerTitle}>
            {existingPlots.length > 0
              ? `This phone number belongs to ${existingFarmer.name} — existing plots:`
              : `${existingFarmer.name} is already registered in ${existingFarmer.village_name}.`}
          </Text>
          {existingPlots.map((p) => (
            <Text key={p.id} style={styles.existingBannerLine}>
              • {p.crop_name} — {PLOT_TYPE_LABELS[p.plot_type]} ({STATUS_LABELS[p.demo_status]}), {p.village_name}
            </Text>
          ))}
        </View>
      )}

      <LocationPicker token={token} onVillageChange={setVillageId} lockedVillage={lockedVillage} />

      <Text style={styles.label}>Type of Training</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={trainingType} onValueChange={setTrainingType}>
          {TRAINING_TYPES.map((t) => (
            <Picker.Item key={t.value} label={t.label} value={t.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Extension Materials Used?</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={extMaterialUsed} onValueChange={setExtMaterialUsed}>
          {MAT_USED_OPTIONS.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>

      <RatingSelect label="Farmer Interaction Quality" value={interactionQuality} onChange={setInteractionQuality} />

      <Text style={styles.label}>Gender Interaction</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={genderInteraction} onValueChange={setGenderInteraction}>
          {GENDER_INTERACTIONS.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Seating Arrangement</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={seating} onValueChange={setSeating}>
          {SEATING_OPTIONS.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Observations & Remarks</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Optional"
        multiline
      />

      <Text style={styles.label}>Training Activity Photo</Text>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.thumbLarge} />
      ) : (
        <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await pickPhoto())}>
          <Text style={styles.photoBtnText}>+ Photo of the Training (required)</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Training</Text>}
      </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  container: { padding: 24, paddingBottom: 60 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  existingBanner: { backgroundColor: COLORS.primarySoft, borderRadius: 8, padding: 12, marginTop: 10 },
  existingBannerTitle: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  existingBannerLine: { color: COLORS.primaryDark, fontSize: 13, marginTop: 2 },
  photoBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, borderStyle: 'dashed',
    padding: 16, alignItems: 'center',
  },
  photoBtnText: { color: COLORS.textMuted, fontSize: 14 },
  thumbLarge: { width: '100%', height: 180, borderRadius: 8 },
  error: { color: COLORS.danger, marginTop: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
