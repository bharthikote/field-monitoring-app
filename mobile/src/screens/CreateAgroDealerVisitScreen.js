import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { createAgroDealerVisit } from '../api';
import MultiSelectField from '../components/MultiSelectField';
import { pickPhoto, assetToFormFile } from '../photo';
import { COLORS } from '../theme';

// Unlike Institutional Visit's Purpose of Visit, the Kobo form has no
// free-text "Others" companion field for this one - "Others" is just a
// plain selectable option here, matching the source form exactly.
const PURPOSE_OPTIONS = [
  { id: 'bill', name: 'Collect Bill / Invoice' },
  { id: 'materials', name: 'Collect Materials / Inputs' },
  { id: 'data', name: 'Collect Data' },
  { id: 'general', name: 'General Visit' },
  { id: 'others', name: 'Others' },
];

// `dealer` is picked (or freshly registered) before this screen is ever
// reached - see AgroDealersListScreen/CreateAgroDealerScreen and App.js's
// select-agro-dealer step.
export default function CreateAgroDealerVisitScreen({ token, dealer, onBack, onCreated }) {
  const [selectedPurposes, setSelectedPurposes] = useState([]);
  const [observations, setObservations] = useState('');
  const [photo, setPhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!photo) {
      setError('Please add a photo of the visit.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('dealerId', dealer.id);
      form.append('purposes', JSON.stringify(selectedPurposes));
      form.append('observations', observations);
      form.append('photo', assetToFormFile(photo));

      await createAgroDealerVisit(token, form);
      Alert.alert('Visit logged', '', [{ text: 'OK', onPress: onCreated }]);
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
        <Text style={styles.title}>Log Agro Dealer Visit</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.entityBox}>
          <Text style={styles.entityName}>{dealer.name}</Text>
          <Text style={styles.entityLine}>{dealer.village_name}</Text>
        </View>

        <MultiSelectField
          label="Purpose of Visit"
          placeholder="-- select purpose --"
          options={PURPOSE_OPTIONS}
          selectedIds={selectedPurposes}
          onChange={setSelectedPurposes}
        />

        <Text style={styles.label}>Observations & Remarks</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={observations}
          onChangeText={setObservations}
          placeholder="Optional"
          multiline
        />

        <Text style={styles.label}>Dealer Visit Photo</Text>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.thumbLarge} />
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Photo of the Visit (required)</Text>
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Visit</Text>}
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
  entityBox: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14 },
  entityName: { fontSize: 18, fontWeight: '700', color: '#111' },
  entityLine: { color: '#555', marginTop: 2, fontSize: 13 },
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
