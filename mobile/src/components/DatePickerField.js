import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}$/;

// Plain YYYY-MM-DD text entry rather than a native calendar widget -
// @react-native-community/datetimepicker's Android build depends on a
// codegen'd native spec file that isn't generated under Expo Go's managed
// workflow (no prebuild step), so it crashes Metro on import. A validated
// text field needs no native module at all, same approach as the phone
// number field elsewhere in this app.
export default function DatePickerField({ label, value, onChange }) {
  const isInvalid = value.length > 0 && !DATE_LIKE.test(value);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, isInvalid && styles.inputInvalid]}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      {isInvalid && <Text style={styles.hint}>Use the format YYYY-MM-DD, e.g. 2026-12-15</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  inputInvalid: { borderColor: COLORS.danger },
  hint: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
});
