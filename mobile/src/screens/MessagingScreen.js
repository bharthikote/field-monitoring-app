import { View, Text, StyleSheet } from 'react-native';

export default function MessagingScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.empty}>Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  empty: { color: '#888' },
});
