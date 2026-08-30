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

// A search-filterable multi-select dropdown - selected items show as
// removable chips above the field, and tapping the field re-opens the
// picker so more can be added without losing the current selection.
export default function MultiSelectField({ label, placeholder = '-- select --', options, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedItems = selectedIds.map((id) => options.find((o) => o.id === id)).filter(Boolean);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const remove = (id) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>

      {selectedItems.length > 0 && (
        <View style={styles.chipRow}>
          {selectedItems.map((item) => (
            <View key={item.id} style={styles.chip}>
              <Text style={styles.chipText}>{item.name}</Text>
              <Pressable onPress={() => remove(item.id)} hitSlop={8}>
                <Text style={styles.chipRemove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.field} onPress={() => { setQuery(''); setOpen(true); }}>
        <Text style={styles.fieldText}>{selectedItems.length > 0 ? '+ Add more' : placeholder}</Text>
        <ChevronIcon color={COLORS.textMuted} />
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
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <Pressable style={styles.optionRow} onPress={() => toggle(item.id)}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={styles.optionText}>{item.name}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
            />

            <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  label: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primarySoft,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: COLORS.primaryDark, fontWeight: '600' },
  chipRemove: { fontSize: 13, color: COLORS.primaryDark },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12,
  },
  fieldText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  optionText: { fontSize: 15, color: '#111' },
  emptyText: { padding: 20, textAlign: 'center', color: '#888' },
  doneButton: { backgroundColor: COLORS.primary, margin: 16, borderRadius: 8, padding: 14, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
