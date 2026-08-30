import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createDemoPlot, getPlotsByPhone } from '../api';
import LocationPicker from '../components/LocationPicker';
import CropVarietyPicker from '../components/CropVarietyPicker';
import { COLORS } from '../theme';

const STATUSES = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'terminated', label: 'Terminated' },
];

const TITLES = { demo: 'New Demo Plot', adoption: 'New Adoption Plot' };
const BUTTON_LABELS = { demo: 'Create Demo Plot', adoption: 'Create Adoption Plot' };
const PLOT_TYPE_LABELS = { demo: 'Demo', adoption: 'Adoption' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const PHONE_LIKE = /^\d{6,}$/;

export default function CreateDemoPlotScreen({ token, plotType = 'demo', initialPhone, onBack, onCreated }) {
  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState(initialPhone || '');
  const [cropId, setCropId] = useState(null);
  const [varietyId, setVarietyId] = useState(null);
  const [villageId, setVillageId] = useState(null);
  const [status, setStatus] = useState('ongoing');
  const [loading, setLoading] = useState(false);
  const [existingPlots, setExistingPlots] = useState(null);

  // Phone number is the farmer's key identifier (PRD Section 5) - as soon
  // as a full number is typed, look up whether it already belongs to
  // someone, across every plot type, so the person creating this one knows
  // it's the same farmer before they even submit.
  useEffect(() => {
    const trimmed = phone.trim();
    if (!PHONE_LIKE.test(trimmed)) {
      setExistingPlots(null);
      return undefined;
    }
    const timeout = setTimeout(() => {
      getPlotsByPhone(token, trimmed)
        .then((data) => {
          setExistingPlots(data.demoPlots);
          if (data.demoPlots.length > 0) {
            setFarmerName((prev) => (prev.trim() ? prev : data.demoPlots[0].farmer_name));
          }
        })
        .catch(() => setExistingPlots(null));
    }, 400);
    return () => clearTimeout(timeout);
  }, [phone, token]);

  const submit = async (nameOverride) => {
    const finalName = nameOverride ?? farmerName;
    setLoading(true);
    try {
      await createDemoPlot(token, { farmerName: finalName, phone, cropId, varietyId, villageId, demoStatus: status, plotType });
      Alert.alert('Demo plot created', '', [{ text: 'OK', onPress: () => onCreated(phone) }]);
    } catch (err) {
      if (err.code === 'duplicate_plot') {
        Alert.alert('Already Exists', err.message, [{ text: 'OK', onPress: () => onCreated(phone) }]);
      } else if (err.code === 'name_mismatch') {
        Alert.alert('Already Registered', err.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: `Add to ${err.existingFarmerName}`, onPress: () => submit(err.existingFarmerName) },
        ]);
      } else {
        Alert.alert('Failed', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!farmerName || !phone || !cropId || !varietyId || !villageId) {
      Alert.alert('Missing info', 'Please fill in farmer name, phone, crop, variety, and village.');
      return;
    }
    submit();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Back'}</Text>
      </Pressable>
      <Text style={styles.title}>{TITLES[plotType]}</Text>

      <Text style={styles.label}>Farmer Name</Text>
      <TextInput style={styles.input} value={farmerName} onChangeText={setFarmerName} />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      {existingPlots?.length > 0 && (
        <View style={styles.existingBanner}>
          <Text style={styles.existingBannerTitle}>
            This phone number belongs to {existingPlots[0].farmer_name} — existing plots:
          </Text>
          {existingPlots.map((p) => (
            <Text key={p.id} style={styles.existingBannerLine}>
              • {p.crop_name} — {PLOT_TYPE_LABELS[p.plot_type]} ({STATUS_LABELS[p.demo_status]}), {p.village_name}
            </Text>
          ))}
        </View>
      )}

      <CropVarietyPicker
        token={token}
        onChange={({ cropId, varietyId }) => {
          setCropId(cropId);
          setVarietyId(varietyId);
        }}
      />

      <LocationPicker token={token} onVillageChange={setVillageId} />

      <Text style={styles.label}>Status</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={status} onValueChange={setStatus}>
          {STATUSES.map((s) => (
            <Picker.Item key={s.value} label={s.label} value={s.value} />
          ))}
        </Picker>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{BUTTON_LABELS[plotType]}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 60 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  existingBanner: { backgroundColor: COLORS.primarySoft, borderRadius: 8, padding: 12, marginTop: 10 },
  existingBannerTitle: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  existingBannerLine: { color: COLORS.primaryDark, fontSize: 13, marginTop: 2 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
