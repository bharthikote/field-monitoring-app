import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

// Simple 1-5 rating control (Farmer Interaction Quality) - no scale/slider
// component exists elsewhere in the app, so this is the smallest thing that
// fits: five tappable numbered circles, filled when selected.
export default function RatingSelect({ label, value, onChange }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              style={[styles.circle, selected && styles.circleSelected]}
              onPress={() => onChange(n)}
            >
              <Text style={[styles.circleText, selected && styles.circleTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10 },
  circle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ccc',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  circleSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  circleText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  circleTextSelected: { color: '#fff' },
});
