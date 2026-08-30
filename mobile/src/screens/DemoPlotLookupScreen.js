import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { searchDemoPlots, listDemoPlots } from '../api';
import { COLORS } from '../theme';

// Same lens icon used in the web admin panel's search bars.
function SearchIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

const PHONE_LIKE = /^\d{6,}$/;

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};

const PLOT_TYPE_LABELS = { demo: 'Demo Plots', adoption: 'Adoption Plots' };
const PLOT_TYPE_LABELS_SINGULAR = { demo: 'demo plot', adoption: 'adoption plot' };

export default function DemoPlotLookupScreen({ token, plotType = 'demo', initialPhone, onBack, onScrollDirectionChange, onCreateNew, onSelectPlot }) {
  const [searchOpen, setSearchOpen] = useState(!!initialPhone);
  const [query, setQuery] = useState(initialPhone || '');
  const [results, setResults] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState(''); // '' means "browsing all"
  const lastScrollOffset = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listDemoPlots(token, plotType);
      setResults(data.demoPlots);
      setSearchedQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return loadAll();
    }
    setLoading(true);
    setError('');
    try {
      const data = await searchDemoPlots(token, trimmed, plotType);
      setResults(data.demoPlots);
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

  // Scrolling down (away from the top) hides the bottom tab bar to give the
  // list more room; scrolling up, or being near the top, brings it back.
  // A small threshold avoids flicker from tiny scroll jitter.
  const handleScroll = (e) => {
    if (!onScrollDirectionChange) return;
    const offset = e.nativeEvent.contentOffset.y;
    const diff = offset - lastScrollOffset.current;
    if (offset <= 10) {
      onScrollDirectionChange(true);
    } else if (diff > 10) {
      onScrollDirectionChange(false);
    } else if (diff < -10) {
      onScrollDirectionChange(true);
    }
    lastScrollOffset.current = offset;
  };

  useEffect(() => {
    if (initialPhone) {
      handleSearch(initialPhone);
    } else {
      loadAll();
    }
  }, [initialPhone]);

  // Live-filters as the user types, once the search bar is open.
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
            <Text style={styles.title}>{PLOT_TYPE_LABELS[plotType]}</Text>
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
                placeholder="Name, phone, or village"
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          results !== null && results.length > 0 ? (
            <Text style={styles.sectionLabel}>
              {searchedQuery ? `Results for "${searchedQuery}"` : `All ${PLOT_TYPE_LABELS[plotType]} (${results.length})`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading && results !== null ? (
            <Text style={styles.empty}>
              {searchedQuery
                ? `No ${PLOT_TYPE_LABELS_SINGULAR[plotType]} matched your search.`
                : `No ${PLOT_TYPE_LABELS_SINGULAR[plotType]}s created yet.`}
            </Text>
          ) : null
        }
        renderItem={({ item: plot }) => (
          <Pressable style={styles.card} onPress={() => onSelectPlot(plot)}>
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
        )}
      />

      <Pressable style={styles.fab} onPress={() => onCreateNew(PHONE_LIKE.test(searchedQuery) ? searchedQuery : '')}>
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
