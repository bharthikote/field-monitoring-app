import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../theme';

function PinIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

// Shared GPS-capture field, originally built for CreateTfoDemoScreen -
// tapping the pin button reads the device's current position via
// expo-location and reports it up as `onChange({ lat, lng })` (both plain
// strings, matching what the create-* API payloads expect). Permission and
// in-flight state live here since every screen that needs GPS wants the
// same handling, not just the resulting coordinates.
export default function GpsLocationField({ label = 'GPS Location *', lat, lng, onChange, onError }) {
  const [loading, setLoading] = useState(false);

  const captureGps = async () => {
    onError('');
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        onError('Location permission is required to capture GPS.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      onChange({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
    } catch (err) {
      onError('Could not get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.gpsRow}>
        <View style={styles.gpsField}>
          <Text style={lat ? styles.gpsText : styles.gpsPlaceholder}>
            {lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'xxxxxxx , xxxxxxx'}
          </Text>
        </View>
        <Pressable style={styles.gpsButton} onPress={captureGps} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <PinIcon />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  gpsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  gpsField: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  gpsText: { fontSize: 16, color: '#111' },
  gpsPlaceholder: { fontSize: 16, color: '#999' },
  gpsButton: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
});
