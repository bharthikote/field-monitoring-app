import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { searchDemoPlots, listDemoPlots } from '../api';
import { COLORS } from '../theme';

const PHONE_LIKE = /^\d{6,}$/;

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};

export default function DemoPlotLookupScreen({ token, initialPhone, onBack, onCreateNew, onSelectPlot }) {
  const [query, setQuery] = useState(initialPhone || '');
  const [results, setResults] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState(''); // '' means "browsing all"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listDemoPlots(token);
      setResults(data.demoPlots);
      setSearchedQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (searchQuery = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return loadAll();
    }
    setLoading(true);
    setError('');
    try {
      const data = await searchDemoPlots(token, trimmed);
      setResults(data.demoPlots);
      setSearchedQuery(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    loadAll();
  };

  useEffect(() => {
    if (initialPhone) {
      handleSearch(initialPhone);
    } else {
      loadAll();
    }
  }, [initialPhone]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Demo Plots</Text>

        <Text style={styles.label}>Search</Text>
        <View style={styles.phoneRow}>
          <View style={styles.phoneWrap}>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Name, phone, or village"
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.searchButton} onPress={() => handleSearch()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {results !== null && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionLabel}>
              {searchedQuery ? `Results for "${searchedQuery}"` : `All Demo Plots (${results.length})`}
            </Text>

            {results.length === 0 ? (
              <Text style={styles.empty}>
                {searchedQuery ? 'No demo plot matched your search.' : 'No demo plots created yet.'}
              </Text>
            ) : (
              results.map((plot) => (
                <Pressable key={plot.id} style={styles.card} onPress={() => onSelectPlot(plot)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{plot.farmer_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[plot.demo_status].bg }]}>
                      <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[plot.demo_status].text }]}>
                        {STATUS_LABELS[plot.demo_status]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardLine}>{plot.farmer_phone}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardCrop}>{plot.crop_name} — {plot.variety_name}</Text>
                    <Text style={styles.cardVillage}>{plot.village_name}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => onCreateNew(PHONE_LIKE.test(searchedQuery) ? searchedQuery : '')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 100 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, paddingRight: 40, fontSize: 16 },
  clearButton: { position: 'absolute', right: 8, padding: 8 },
  clearButtonText: { fontSize: 16, color: '#888' },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  error: { color: COLORS.danger, marginTop: 12 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: '#888', marginBottom: 16 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '700', fontSize: 16, flex: 1, marginRight: 8 },
  cardLine: { color: '#555', marginTop: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardCrop: { color: '#555' },
  cardVillage: { color: '#555', fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
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
