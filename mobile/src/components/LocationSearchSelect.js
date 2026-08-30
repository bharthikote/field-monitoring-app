import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { searchLocations } from '../api';
import { COLORS } from '../theme';

function SearchIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

function ChevronIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

const LEVEL_LABELS = { village: 'Village', block: 'Block', district: 'District' };

// Search-and-pick a Village, Block, or District by name - Institutions and
// Agro Dealers are usually located at a block or district headquarters (a
// KVK, government office, dealer shop), not necessarily a village, so this
// searches all three levels at once instead of villages only. State and
// country are deliberately excluded - too broad to be "a place" someone
// visits.
export default function LocationSearchSelect({ token, onLocationChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(token, query.trim())
        .then((d) => setResults(d.locations))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, token]);

  useEffect(() => {
    onLocationChange(selected ? { level: selected.level, id: selected.id } : null);
  }, [selected]);

  const handleOpen = () => {
    setQuery('');
    setResults([]);
    setOpen(true);
  };

  const handleSelect = (location) => {
    setSelected(location);
    setOpen(false);
  };

  const breadcrumb = selected
    ? [selected.block_name, selected.district_name, selected.state_name, selected.country_name].filter(Boolean).join(' → ')
    : null;

  return (
    <View>
      <Text style={styles.label}>Location</Text>
      <Pressable style={styles.field} onPress={handleOpen}>
        <Text style={selected ? styles.fieldText : styles.placeholderText} numberOfLines={1}>
          {selected ? `${selected.name} (${LEVEL_LABELS[selected.level]})` : '-- search village, block, or district --'}
        </Text>
        <ChevronIcon color={COLORS.textMuted} />
      </Pressable>
      {breadcrumb ? <Text style={styles.breadcrumb}>{breadcrumb}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.searchRow}>
              <SearchIcon color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Type a village, block, or district name..."
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {loading && <ActivityIndicator style={styles.statusIndicator} />}
            {!loading && query.trim().length < 2 && (
              <Text style={styles.hintText}>Type at least 2 characters to search.</Text>
            )}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <Text style={styles.hintText}>No locations matched.</Text>
            )}

            <FlatList
              data={results}
              keyExtractor={(item) => `${item.level}-${item.id}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => handleSelect(item)}>
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionText}>{item.name}</Text>
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelBadgeText}>{LEVEL_LABELS[item.level]}</Text>
                    </View>
                  </View>
                  <Text style={styles.optionSubText}>
                    {[item.block_name, item.district_name, item.state_name, item.country_name].filter(Boolean).join(', ')}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12,
  },
  fieldText: { fontSize: 16, color: '#111', flex: 1, marginRight: 8 },
  placeholderText: { fontSize: 16, color: '#999', flex: 1, marginRight: 8 },
  breadcrumb: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  statusIndicator: { marginTop: 16 },
  hintText: { padding: 20, textAlign: 'center', color: '#888' },
  optionRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 15, color: '#111', fontWeight: '600' },
  optionSubText: { fontSize: 12, color: '#888', marginTop: 2 },
  levelBadge: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  levelBadgeText: { fontSize: 11, color: COLORS.primaryDark, fontWeight: '700' },
});
