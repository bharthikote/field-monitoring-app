import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { createFieldDay } from '../api';
import RatingSelect from '../components/RatingSelect';
import SearchableSelect from '../components/SearchableSelect';
import DatePickerField from '../components/DatePickerField';
import { pickPhoto, assetToFormFile } from '../photo';
import { useGps, appendGps } from '../gps';
import GpsStatus from '../components/GpsStatus';
import { COLORS } from '../theme';

// {id, name} - SearchableSelect's shape (see CreateTrainingScreen for the
// same swap off the native Picker, which renders as the plain Android
// dropdown instead of matching the rest of the app).
const FIELDDAY_TYPES = [
  { id: 'practical', name: 'Practical (Hands-On / Field)' },
  { id: 'theory', name: 'Theory (Classroom / Discussion)' },
  { id: 'both', name: 'Both Practical & Theory' },
];
const ROI_DISCUSSION_OPTIONS = [
  { id: 'both', name: 'Both ROI & Business Plan' },
  { id: 'roi_only', name: 'ROI Only' },
  { id: 'biz_only', name: 'Business Plan Only' },
  { id: 'not_discussed', name: 'Not Discussed' },
];
const YES_NO_OPTIONS = [
  { id: 'yes', name: 'Yes' },
  { id: 'no', name: 'No' },
];

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}$/;

// `farmer` is picked (or freshly registered) before this screen is ever
// reached - see FarmersListScreen/CreateFarmerScreen and App.js's
// select-farmer step - so there's no more name/phone entry or lookup here,
// just a read-only summary of who this entry is for.
export default function CreateFieldDayScreen({ token, farmer, onBack, onCreated }) {
  const [fielddayType, setFielddayType] = useState(FIELDDAY_TYPES[0].id);
  const [interactionQuality, setInteractionQuality] = useState(null);
  const [roiDiscussion, setRoiDiscussion] = useState(ROI_DISCUSSION_OPTIONS[0].id);
  const [salesTeamAttended, setSalesTeamAttended] = useState(YES_NO_OPTIONS[1].id);
  const [salesPersonName, setSalesPersonName] = useState('');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState(null);
  const gps = useGps();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const salesTeamDidAttend = salesTeamAttended === 'yes';

  const handleSubmit = async () => {
    if (!interactionQuality || !expectedHarvestDate || !photo) {
      setError('Please select interaction quality, harvest date, and add a photo.');
      return;
    }
    if (!DATE_LIKE.test(expectedHarvestDate)) {
      setError('Please enter the harvest date as YYYY-MM-DD.');
      return;
    }
    if (salesTeamDidAttend && !salesPersonName.trim()) {
      setError('Please enter the sales person\'s name.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('farmerName', farmer.name);
      form.append('phone', farmer.phone);
      form.append('villageId', farmer.village_id);
      form.append('fielddayType', fielddayType);
      form.append('interactionQuality', String(interactionQuality));
      form.append('roiDiscussion', roiDiscussion);
      form.append('salesTeamAttended', salesTeamAttended);
      if (salesTeamDidAttend) form.append('salesPersonName', salesPersonName);
      form.append('expectedHarvestDate', expectedHarvestDate);
      form.append('remarks', remarks);
      form.append('photo', assetToFormFile(photo));
      appendGps(form, await gps.getForSubmit());

      await createFieldDay(token, form);
      Alert.alert('Field Day logged', '', [{ text: 'OK', onPress: onCreated }]);
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
        <Text style={styles.title}>Log Field Day</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.farmerBox}>
          <Text style={styles.farmerName}>{farmer.name}</Text>
          <Text style={styles.farmerLine}>{farmer.phone}</Text>
          <Text style={styles.farmerLine}>{farmer.village_name}</Text>
        </View>

        <SearchableSelect label="Type of Field Day" options={FIELDDAY_TYPES} value={fielddayType} onChange={setFielddayType} />

        <RatingSelect label="Farmer Interaction Quality" value={interactionQuality} onChange={setInteractionQuality} />

        <SearchableSelect label="ROI & Business Plan Discussed?" options={ROI_DISCUSSION_OPTIONS} value={roiDiscussion} onChange={setRoiDiscussion} />

        <SearchableSelect label="Did Sales Team Attend?" options={YES_NO_OPTIONS} value={salesTeamAttended} onChange={setSalesTeamAttended} />

        {salesTeamDidAttend && (
          <>
            <Text style={styles.label}>Sales Person Name</Text>
            <TextInput style={styles.input} value={salesPersonName} onChangeText={setSalesPersonName} />
          </>
        )}

        <DatePickerField label="Expected First Harvest Date" value={expectedHarvestDate} onChange={setExpectedHarvestDate} />

        <Text style={styles.label}>Observations & Remarks</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Optional"
          multiline
        />

        <Text style={styles.label}>Field Day Activity Photo</Text>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.thumbLarge} />
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Photo of the Field Day (required)</Text>
          </Pressable>
        )}

        <GpsStatus gps={gps} label="Field Day Location" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Field Day</Text>}
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
