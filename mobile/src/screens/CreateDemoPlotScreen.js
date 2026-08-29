import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createDemoPlot } from '../api';
import LocationPicker from '../components/LocationPicker';
import CropVarietyPicker from '../components/CropVarietyPicker';

const STATUSES = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'terminated', label: 'Terminated' },
];

export default function CreateDemoPlotScreen({ token, initialPhone, onBack, onCreated }) {
  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState(initialPhone || '');
  const [cropId, setCropId] = useState(null);
  const [varietyId, setVarietyId] = useState(null);
  const [villageId, setVillageId] = useState(null);
  const [status, setStatus] = useState('ongoing');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!farmerName || !phone || !cropId || !varietyId || !villageId) {
      Alert.alert('Missing info', 'Please fill in farmer name, phone, crop, variety, and village.');
      return;
    }
    setLoading(true);
    try {
      await createDemoPlot(token, { farmerName, phone, cropId, varietyId, villageId, demoStatus: status });
      Alert.alert('Demo plot created', '', [{ text: 'OK', onPress: onCreated }]);
    } catch (err) {
      Alert.alert('Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Back'}</Text>
      </Pressable>
      <Text style={styles.title}>New Demo Plot</Text>

      <Text style={styles.label}>Farmer Name</Text>
      <TextInput style={styles.input} value={farmerName} onChangeText={setFarmerName} />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <CropVarietyPicker
        token={token}
        onChange={({ cropId, varietyId }) => {
          setCropId(cropId);
          setVarietyId(varietyId);
        }}
      />

      <LocationPicker token={token} onVillageChange={setVillageId} />

      <Text style={styles.label}>Demo Status</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={status} onValueChange={setStatus}>
          {STATUSES.map((s) => (
            <Picker.Item key={s.value} label={s.label} value={s.value} />
          ))}
        </Picker>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Demo Plot</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 60 },
  back: { color: '#2563eb', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
