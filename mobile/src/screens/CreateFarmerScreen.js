import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createFarmer, getFarmer } from '../api';
import LocationPicker from '../components/LocationPicker';
import ContactPhoneField from '../components/ContactPhoneField';
import { COLORS } from '../theme';

export default function CreateFarmerScreen({ token, onBack, onCreated, onOpenExisting }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [villageId, setVillageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !villageId) {
      setError('Please fill in name, phone, and village.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('phone', phone.trim());
      form.append('villageId', villageId);
      const created = await createFarmer(token, form);
      // Re-fetch so onCreated gets the full village breadcrumb (POST
      // /farmers only returns the bare row) - callers that log an activity
      // right after registering need it (Training/Field Day skip picking a
      // village again since the farmer's is now known).
      const full = await getFarmer(token, created.farmer.id);
      Alert.alert('Farmer registered', '', [{ text: 'OK', onPress: () => onCreated(full.farmer) }]);
    } catch (err) {
      if (err.code === 'duplicate_phone' && err.existingFarmerId && onOpenExisting) {
        offerExistingProfile(err);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // The phone is already registered - offer to open that profile instead of
  // just showing an error. The profile is only fetchable if it's in the
  // user's own coverage; if it isn't, fall back to the plain message.
  const offerExistingProfile = async (err) => {
    try {
      const existing = await getFarmer(token, err.existingFarmerId);
      Alert.alert('Already registered', err.message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open profile', onPress: () => onOpenExisting(existing.farmer) },
      ]);
    } catch {
      setError(err.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Register Farmer</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Farmer Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <ContactPhoneField
          value={phone}
          onChangeText={setPhone}
          onPickName={(pickedName) => setName((prev) => (prev.trim() ? prev : pickedName))}
        />

        <LocationPicker token={token} onVillageChange={setVillageId} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Farmer</Text>}
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
  error: { color: COLORS.danger, marginTop: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
