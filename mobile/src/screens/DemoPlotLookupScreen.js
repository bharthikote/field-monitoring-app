import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { lookupDemoPlots } from '../api';

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };

export default function DemoPlotLookupScreen({ token, initialPhone, onBack, onCreateNew }) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (searchPhone = phone) => {
    if (!searchPhone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await lookupDemoPlots(token, searchPhone.trim());
      setResults(data.demoPlots);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPhone) handleSearch(initialPhone);
  }, [initialPhone]);

  const showDetail = (plot) => {
    Alert.alert(
      plot.farmer_name,
      `Phone: ${plot.farmer_phone}\nCrop: ${plot.crop_name}\nVariety: ${plot.variety_name}\nVillage: ${plot.village_name}\nStatus: ${STATUS_LABELS[plot.demo_status]}`,
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Back'}</Text>
      </Pressable>
      <Text style={styles.title}>Find Demo Plot</Text>

      <Text style={styles.label}>Farmer Phone Number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Pressable style={styles.button} onPress={() => handleSearch()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results !== null && (
        <View style={{ marginTop: 24 }}>
          {results.length === 0 ? (
            <Text style={styles.empty}>No demo plot found for this number.</Text>
          ) : (
            results.map((plot) => (
              <Pressable key={plot.id} style={styles.card} onPress={() => showDetail(plot)}>
                <Text style={styles.cardTitle}>{plot.farmer_name}</Text>
                <Text style={styles.cardLine}>{plot.crop_name} — {plot.variety_name}</Text>
                <Text style={styles.cardLine}>{plot.village_name}</Text>
                <Text style={styles.cardStatus}>{STATUS_LABELS[plot.demo_status]}</Text>
              </Pressable>
            ))
          )}

          <Pressable style={styles.secondaryButton} onPress={() => onCreateNew(phone.trim())}>
            <Text style={styles.secondaryButtonText}>+ Create New Demo Plot for this Number</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  back: { color: '#2563eb', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#dc2626', marginTop: 12 },
  empty: { color: '#888', marginBottom: 16 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '700', fontSize: 16 },
  cardLine: { color: '#555', marginTop: 2 },
  cardStatus: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    color: '#3730a3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 12,
    overflow: 'hidden',
  },
  secondaryButton: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
});
