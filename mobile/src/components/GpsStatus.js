import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';

// Status line for useGps(): shows the captured position and accuracy, or why
// there isn't one, with a retry. `required` only changes the wording when
// there is no fix - the screen decides whether submit is blocked.
export default function GpsStatus({ gps, label = 'GPS Location', required = false }) {
  const { fix, status, message, refresh } = gps;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <View style={[styles.box, status === 'error' && styles.boxError]}>
        {status === 'loading' && (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.muted}>Getting your location...</Text>
          </View>
        )}
        {status === 'ok' && fix && (
          <View style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.value}>
              {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
              {fix.accuracy != null ? `  (±${Math.round(fix.accuracy)} m)` : ''}
            </Text>
          </View>
        )}
        {status === 'error' && (
          <Text style={styles.errorText}>{message || 'Location unavailable.'}</Text>
        )}
        {status !== 'loading' && (
          <Pressable onPress={refresh} hitSlop={8}>
            <Text style={styles.retry}>{fix ? 'Refresh location' : 'Try again'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  box: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, gap: 6 },
  boxError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  value: { fontSize: 15, color: '#111' },
  muted: { fontSize: 14, color: '#777' },
  errorText: { fontSize: 13, color: '#991b1b' },
  retry: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
