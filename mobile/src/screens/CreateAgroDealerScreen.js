import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createAgroDealer, getAgroDealer } from '../api';
import LocationSearchSelect from '../components/LocationSearchSelect';
import { COLORS } from '../theme';

export default function CreateAgroDealerScreen({ token, onBack, onCreated }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !location) {
      setError('Please fill in name and location.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const created = await createAgroDealer(token, { name: name.trim(), locationLevel: location.level, locationId: location.id });
      // Re-fetch so onCreated gets the full location breadcrumb, same
      // reasoning as CreateInstitutionScreen/CreateFarmerScreen.
      const full = await getAgroDealer(token, created.agroDealer.id);
      Alert.alert('Agro dealer registered', '', [{ text: 'OK', onPress: () => onCreated(full.agroDealer) }]);
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
        <Text style={styles.title}>Register Agro Dealer</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Shop / Dealer Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <LocationSearchSelect token={token} onLocationChange={setLocation} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Agro Dealer</Text>}
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
