import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createFieldDay, getFarmerByPhone } from '../api';
import LocationPicker from '../components/LocationPicker';
import RatingSelect from '../components/RatingSelect';
import DatePickerField from '../components/DatePickerField';
import { pickPhoto, assetToFormFile } from '../photo';
import { COLORS } from '../theme';

const FIELDDAY_TYPES = [
  { value: 'practical', label: 'Practical (Hands-On / Field)' },
  { value: 'theory', label: 'Theory (Classroom / Discussion)' },
  { value: 'both', label: 'Both Practical & Theory' },
];
const ROI_DISCUSSION_OPTIONS = [
  { value: 'both', label: 'Both ROI & Business Plan' },
  { value: 'roi_only', label: 'ROI Only' },
  { value: 'biz_only', label: 'Business Plan Only' },
  { value: 'not_discussed', label: 'Not Discussed' },
];
const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const PHONE_LIKE = /^\d{6,}$/;
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}$/;
const PLOT_TYPE_LABELS = { demo: 'Demo', adoption: 'Adoption' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };

export default function CreateFieldDayScreen({ token, onBack, onCreated }) {
  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState('');
  const [villageId, setVillageId] = useState(null);
  const [existingFarmer, setExistingFarmer] = useState(null);
  const [existingPlots, setExistingPlots] = useState([]);

  const [fielddayType, setFielddayType] = useState(FIELDDAY_TYPES[0].value);
  const [interactionQuality, setInteractionQuality] = useState(null);
  const [roiDiscussion, setRoiDiscussion] = useState(ROI_DISCUSSION_OPTIONS[0].value);
  const [salesTeamAttended, setSalesTeamAttended] = useState(YES_NO_OPTIONS[1].value);
  const [salesPersonName, setSalesPersonName] = useState('');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Same "this phone already belongs to a registered farmer" lookup as
  // Demo Plot/Training's create forms.
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

  const salesTeamDidAttend = salesTeamAttended === 'yes';

  const handleSubmit = async () => {
    if (!farmerName || !phone || !villageId || !interactionQuality || !expectedHarvestDate || !photo) {
      setError('Please fill in farmer name, phone, village, interaction quality, harvest date, and add a photo.');
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
      form.append('farmerName', farmerName);
      form.append('phone', phone);
      form.append('villageId', villageId);
      form.append('fielddayType', fielddayType);
      form.append('interactionQuality', String(interactionQuality));
      form.append('roiDiscussion', roiDiscussion);
      form.append('salesTeamAttended', salesTeamAttended);
      if (salesTeamDidAttend) form.append('salesPersonName', salesPersonName);
      form.append('expectedHarvestDate', expectedHarvestDate);
      form.append('remarks', remarks);
      form.append('photo', assetToFormFile(photo));

      await createFieldDay(token, form);
      Alert.alert('Field Day logged', '', [{ text: 'OK', onPress: onCreated }]);
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
        <Text style={styles.title}>Log Field Day</Text>
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

        <Text style={styles.label}>Type of Field Day</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={fielddayType} onValueChange={setFielddayType}>
            {FIELDDAY_TYPES.map((t) => (
              <Picker.Item key={t.value} label={t.label} value={t.value} />
            ))}
          </Picker>
        </View>

        <RatingSelect label="Farmer Interaction Quality" value={interactionQuality} onChange={setInteractionQuality} />

        <Text style={styles.label}>ROI & Business Plan Discussed?</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={roiDiscussion} onValueChange={setRoiDiscussion}>
            {ROI_DISCUSSION_OPTIONS.map((o) => (
              <Picker.Item key={o.value} label={o.label} value={o.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Did Sales Team Attend?</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={salesTeamAttended} onValueChange={setSalesTeamAttended}>
            {YES_NO_OPTIONS.map((o) => (
              <Picker.Item key={o.value} label={o.label} value={o.value} />
            ))}
          </Picker>
        </View>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Field Day</Text>}
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
