import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, FlatList } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
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

// A tap-to-open, search-to-filter dropdown - stands in for the native
// Picker anywhere a list can be long enough that scrolling a wheel to
// find one item (e.g. dozens of crops) is impractical.
export default function SearchableSelect({ label, placeholder = 'Select...', options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const handleOpen = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
  };

  const handleSelect = (option) => {
    onChange(option.id);
    setOpen(false);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={[styles.field, disabled && styles.fieldDisabled]} onPress={handleOpen}>
        <Text style={selected ? styles.fieldText : styles.placeholderText} numberOfLines={1}>
          {selected ? selected.name : placeholder}
        </Text>
        <ChevronIcon color={disabled ? '#ccc' : COLORS.textMuted} />
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
                placeholder="Search..."
                autoFocus
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, item.id === value && styles.optionRowSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.optionText, item.id === value && styles.optionTextSelected]}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
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
  optionRow: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  optionRowSelected: { backgroundColor: COLORS.primarySoft },
  optionText: { fontSize: 15, color: '#111' },
  optionTextSelected: { color: COLORS.primaryDark, fontWeight: '700' },
  emptyText: { padding: 20, textAlign: 'center', color: '#888' },
});
