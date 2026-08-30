import { View, Text, Pressable, StyleSheet } from 'react-native';

const TABS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'issues', icon: '⚠️', label: 'Issues' },
  { key: 'notifications', icon: '🔔', label: 'Alerts' },
  { key: 'messaging', icon: '💬', label: 'Messages' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

export default function BottomTabBar({ active, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e2e2',
    backgroundColor: '#fff', paddingTop: 8, paddingBottom: 20,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  label: { fontSize: 11, color: '#888', marginTop: 2 },
  labelActive: { color: '#2563eb', fontWeight: '700' },
});
