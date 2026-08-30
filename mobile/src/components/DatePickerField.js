import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// value/onChange use plain 'YYYY-MM-DD' strings (matches what the backend
// expects) rather than Date objects, so callers don't need to know about
// the native picker underneath.
export default function DatePickerField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00`) : new Date();

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(formatDate(selectedDate));
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.fieldText : styles.placeholderText}>{value || '-- select date --'}</Text>
      </Pressable>
      {open && (
        <DateTimePicker value={dateValue} mode="date" display="default" onChange={handleChange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  field: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  fieldText: { fontSize: 16, color: '#111' },
  placeholderText: { fontSize: 16, color: '#999' },
});
