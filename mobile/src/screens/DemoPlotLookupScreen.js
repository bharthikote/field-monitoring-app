import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { lookupDemoPlots, listDemoPlots } from '../api';

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };

export default function DemoPlotLookupScreen({ token, initialPhone, onBack, onCreateNew }) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [results, setResults] = useState(null);
  const [searchedPhone, setSearchedPhone] = useState(''); // '' means "browsing all"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listDemoPlots(token);
      setResults(data.demoPlots);
      setSearchedPhone('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (searchPhone = phone) => {
    const trimmed = searchPhone.trim();
    if (!trimmed) {
      return loadAll();
    }
    setLoading(true);
    setError('');
    try {
      const data = await lookupDemoPlots(token, trimmed);
      setResults(data.demoPlots);
      setSearchedPhone(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPhone('');
    loadAll();
  };

  useEffect(() => {
    if (initialPhone) {
      handleSearch(initialPhone);
    } else {
      loadAll();
    }
  }, [initialPhone]);

  const showDetail = (plot) => {
    Alert.alert(
      plot.farmer_name,
      `Phone: ${plot.farmer_phone}\nCrop: ${plot.crop_name}\nVariety: ${plot.variety_name}\nVillage: ${plot.village_name}\nStatus: ${STATUS_LABELS[plot.demo_status]}`,
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Demo Plots</Text>

        <Text style={styles.label}>Farmer Phone Number</Text>
        <View style={styles.phoneWrap}>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Search by phone number"
          />
          {phone.length > 0 && (
            <Pressable style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.button} onPress={() => handleSearch()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search</Text>}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {results !== null && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionLabel}>
              {searchedPhone ? `Results for ${searchedPhone}` : `All Demo Plots (${results.length})`}
            </Text>

            {results.length === 0 ? (
              <Text style={styles.empty}>
                {searchedPhone ? 'No demo plot found for this number.' : 'No demo plots created yet.'}
              </Text>
            ) : (
              results.map((plot) => (
                <Pressable key={plot.id} style={styles.card} onPress={() => showDetail(plot)}>
                  <Text style={styles.cardTitle}>{plot.farmer_name}</Text>
                  <Text style={styles.cardLine}>{plot.farmer_phone}</Text>
                  <Text style={styles.cardLine}>{plot.crop_name} — {plot.variety_name}</Text>
                  <Text style={styles.cardLine}>{plot.village_name}</Text>
                  <Text style={styles.cardStatus}>{STATUS_LABELS[plot.demo_status]}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => onCreateNew(searchedPhone)}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 100 },
  back: { color: '#2563eb', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  phoneWrap: { position: 'relative', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, paddingRight: 40, fontSize: 16 },
  clearButton: { position: 'absolute', right: 8, padding: 8 },
  clearButtonText: { fontSize: 16, color: '#888' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#dc2626', marginTop: 12 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
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
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '400' },
});
