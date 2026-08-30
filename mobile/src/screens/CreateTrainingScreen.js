import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { createTraining } from '../api';
import RatingSelect from '../components/RatingSelect';
import SearchableSelect from '../components/SearchableSelect';
import { pickPhoto, assetToFormFile } from '../photo';
import { COLORS } from '../theme';

// {id, name} rather than {value, label} - SearchableSelect (the same
// tap-to-open dropdown used for Crop/Variety/Village elsewhere) expects
// that shape, and it replaces the native Picker here since the OS-default
// dropdown didn't match the rest of the app's UI (same feedback that
// already moved Disease/Pest off the native picker).
const TRAINING_TYPES = [
  { id: 'classroom', name: 'Classroom / Theory' },
  { id: 'field_based', name: 'Field-Based / Practical' },
  { id: 'mixed', name: 'Mixed (Both)' },
];
const MAT_USED_OPTIONS = [
  { id: 'ext_material_only', name: 'Extension Material Only' },
  { id: 'training_material_only', name: 'Training Material Only' },
  { id: 'both', name: 'Both' },
  { id: 'none', name: 'None' },
];
const GENDER_INTERACTIONS = [
  { id: 'both_interacted', name: 'Both Interacted' },
  { id: 'only_male', name: 'Only Male' },
  { id: 'only_female', name: 'Only Female' },
  { id: 'no_interaction', name: 'No Interaction' },
];
const SEATING_OPTIONS = [
  { id: 'equal', name: 'Equal / No Issues' },
  { id: 'discriminatory', name: 'Discrimination Observed' },
];

// `farmer` is picked (or freshly registered) before this screen is ever
// reached - see FarmersListScreen/CreateFarmerScreen and App.js's
// select-farmer step - so there's no more name/phone entry or lookup here,
// just a read-only summary of who this entry is for.
export default function CreateTrainingScreen({ token, farmer, onBack, onCreated }) {
  const [trainingType, setTrainingType] = useState(TRAINING_TYPES[0].id);
  const [extMaterialUsed, setExtMaterialUsed] = useState(MAT_USED_OPTIONS[0].id);
  const [interactionQuality, setInteractionQuality] = useState(null);
  const [genderInteraction, setGenderInteraction] = useState(GENDER_INTERACTIONS[0].id);
  const [seating, setSeating] = useState(SEATING_OPTIONS[0].id);
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!interactionQuality || !photo) {
      setError('Please select interaction quality and add a photo.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('farmerName', farmer.name);
      form.append('phone', farmer.phone);
      form.append('villageId', farmer.village_id);
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Log Training</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.farmerBox}>
          <Text style={styles.farmerName}>{farmer.name}</Text>
          <Text style={styles.farmerLine}>{farmer.phone}</Text>
          <Text style={styles.farmerLine}>{farmer.village_name}</Text>
        </View>

        <SearchableSelect label="Type of Training" options={TRAINING_TYPES} value={trainingType} onChange={setTrainingType} />

        <SearchableSelect label="Extension Materials Used?" options={MAT_USED_OPTIONS} value={extMaterialUsed} onChange={setExtMaterialUsed} />

        <RatingSelect label="Farmer Interaction Quality" value={interactionQuality} onChange={setInteractionQuality} />

        <SearchableSelect label="Gender Interaction" options={GENDER_INTERACTIONS} value={genderInteraction} onChange={setGenderInteraction} />

        <SearchableSelect label="Seating Arrangement" options={SEATING_OPTIONS} value={seating} onChange={setSeating} />

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
    </KeyboardAvoidingView>
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
  farmerBox: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14 },
  farmerName: { fontSize: 18, fontWeight: '700', color: '#111' },
  farmerLine: { color: '#555', marginTop: 2, fontSize: 13 },
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
