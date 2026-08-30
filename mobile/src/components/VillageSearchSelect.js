import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { searchVillages } from '../api';
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

// Search-and-pick a village directly by name instead of stepping through
// Country > State > District > Block first. Each result carries its full
// path (two villages can share a name in different states/countries), so
// the caller can show it back as a confirmation once picked.
export default function VillageSearchSelect({ token, value, selectedLabel, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
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
      searchVillages(token, query.trim())
        .then((d) => setResults(d.villages))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, token]);

  const handleOpen = () => {
    if (disabled) return;
    setQuery('');
    setResults([]);
    setOpen(true);
  };

  const handleSelect = (village) => {
    onSelect(village);
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>Village</Text>
      <Pressable style={[styles.field, disabled && styles.fieldDisabled]} onPress={handleOpen}>
        <Text style={value ? styles.fieldText : styles.placeholderText} numberOfLines={1}>
          {value ? selectedLabel : '-- search village --'}
        </Text>
        {!disabled && <ChevronIcon color={COLORS.textMuted} />}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.searchRow}>
              <SearchIcon color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Type a village name..."
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {loading && <ActivityIndicator style={styles.statusIndicator} />}
            {!loading && query.trim().length < 2 && (
              <Text style={styles.hintText}>Type at least 2 characters to search.</Text>
            )}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <Text style={styles.hintText}>No villages matched.</Text>
            )}

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isDuplicateName = results.filter((r) => r.name === item.name).length > 1;
                return (
                  <Pressable style={styles.optionRow} onPress={() => handleSelect(item)}>
                    <Text style={styles.optionText}>{item.name}</Text>
                    {isDuplicateName ? (
                      <Text style={styles.optionSubText}>
                        {item.block_name}, {item.district_name}, {item.state_name}, {item.country_name}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              }}
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
  fieldDisabled: { backgroundColor: '#f5f5f5' },
  fieldText: { fontSize: 16, color: '#111', flex: 1, marginRight: 8 },
  placeholderText: { fontSize: 16, color: '#999', flex: 1, marginRight: 8 },
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
  optionText: { fontSize: 15, color: '#111', fontWeight: '600' },
  optionSubText: { fontSize: 12, color: '#888', marginTop: 2 },
});
