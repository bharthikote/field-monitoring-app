import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

// Shared by every TFO activity form that captures a numeric value (area,
// counts, pH, etc.) - originally built for CreateTfoDemoScreen, pulled out
// here so CreateHomeGardenScreen (and any future activity form) uses the
// exact same field/keyboard/suffix behavior instead of a copy.
export default function NumberField({ label, value, onChangeText, suffix }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.suffixWrap}>
        <TextInput style={[styles.input, suffix && styles.inputWithSuffix]} value={value} onChangeText={onChangeText} keyboardType="numeric" />
        {suffix ? <Text style={styles.suffixText}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  suffixWrap: { position: 'relative', justifyContent: 'center' },
  inputWithSuffix: { paddingRight: 40 },
  suffixText: { position: 'absolute', right: 12, color: COLORS.textMuted, fontSize: 13 },
});
