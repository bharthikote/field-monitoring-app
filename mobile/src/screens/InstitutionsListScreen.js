import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { searchInstitutions, listInstitutions } from '../api';
import { COLORS } from '../theme';

function SearchIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

// Reached only from Home's Institutional Visit card (no dedicated tab, see
// FarmersListScreen for the tab-vs-drill-down distinction) - always has a
// back link, so unlike FarmersListScreen it's not optional here.
export default function InstitutionsListScreen({ token, onBack, onCreateNew, onSelectInstitution }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listInstitutions(token);
      setResults(data.institutions);
      setSearchedQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return loadAll();
    setLoading(true);
    setError('');
    try {
      const data = await searchInstitutions(token, trimmed);
      setResults(data.institutions);
      setSearchedQuery(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSearch = () => {
    setSearchOpen(false);
    setQuery('');
    loadAll();
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const timeout = setTimeout(() => handleSearch(query), 300);
    return () => clearTimeout(timeout);
  }, [query, searchOpen]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        {!searchOpen ? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>Select Institution</Text>
            <Pressable style={styles.searchIconButton} onPress={() => setSearchOpen(true)}>
              <SearchIcon color={COLORS.primary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Name or village"
                autoCapitalize="none"
                autoFocus
              />
              {query.length > 0 && (
                <Pressable style={styles.clearButton} onPress={() => setQuery('')}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={handleCloseSearch}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && <ActivityIndicator style={styles.loadingIndicator} />}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={results || []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          results !== null && results.length > 0 ? (
            <Text style={styles.sectionLabel}>
              {searchedQuery ? `Results for "${searchedQuery}"` : `All Institutions (${results.length})`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading && results !== null ? (
            <Text style={styles.empty}>
              {searchedQuery ? 'No institutions matched your search.' : 'No institutions registered yet.'}
            </Text>
          ) : null
        }
        renderItem={({ item: institution }) => (
          <Pressable style={styles.card} onPress={() => onSelectInstitution(institution)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{institution.name}</Text>
              <Text style={styles.cardVillage}>{institution.village_name}</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={onCreateNew}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  searchIconButton: { padding: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchInputWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  searchInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, paddingRight: 40, fontSize: 16 },
  clearButton: { position: 'absolute', right: 8, padding: 8 },
  clearButtonText: { fontSize: 16, color: '#888' },
  cancelText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  loadingIndicator: { marginTop: 12 },
  list: { flex: 1 },
  listContent: { padding: 24, paddingTop: 16, paddingBottom: 100 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: '#888', marginBottom: 16 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '700', fontSize: 16, flex: 1, marginRight: 8 },
  cardVillage: { color: '#555', fontSize: 13, textAlign: 'right' },
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
