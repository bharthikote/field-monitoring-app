import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { ROLES } from '../roles';

// The six daily field activities, exactly as the Kobo form presents them
// (same keys/order as its `topic` choice list) - this is the menu every
// field-activity role sees immediately after login.
const ACTIVITIES = [
  { key: 'training', label: 'Training' },
  { key: 'fieldday', label: 'Field Day' },
  { key: 'demoplot', label: 'Demo Plot' },
  { key: 'adoption', label: 'Adoption Plot' },
  { key: 'govt', label: 'Govt. / Institutional Visit' },
  { key: 'agriinput', label: 'Agri-Input Dealer Visit' },
];

// Team Lead, Supervisor, and Country Manager are the field-activity roles
// (PRD Section 1) - they get the six-activity menu. TFO's entire role in
// this system (Phase 1) is viewing/resolving assigned issues (its own
// bottom tab now); the other five activities stay in the vendor app for TFO.
const ACTIVITY_ROLES = ['supervisor', 'team_lead', 'country_manager'];

function ActivityCard({ label, onPress }) {
  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <Text style={styles.activityCardText}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ user, onFindDemoPlot }) {
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label || user.role;
  const showActivities = ACTIVITY_ROLES.includes(user.role);

  const handleActivity = (activity) => {
    if (activity.key === 'demoplot') {
      onFindDemoPlot();
      return;
    }
    Alert.alert('Coming Soon', `${activity.label} isn't built yet.`);
  };

  if (!showActivities) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Welcome, {user.name}</Text>
        <Text style={styles.subtitle}>{roleLabel}</Text>
        <Text style={styles.userCode}>ID: {user.userCode}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}</Text>
      <Text style={styles.subtitle}>{roleLabel}</Text>
      <Text style={styles.userCode}>ID: {user.userCode}</Text>

      <Text style={styles.sectionLabel}>What are you monitoring today?</Text>
      <View style={styles.grid}>
        {ACTIVITIES.map((activity) => (
          <ActivityCard key={activity.key} label={activity.label} onPress={() => handleActivity(activity)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  centeredContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#555', marginTop: 4 },
  userCode: { fontSize: 13, color: '#888', marginTop: 4, fontFamily: 'monospace' },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 32, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  activityCard: {
    width: '47%', minHeight: 90, borderRadius: 10, borderWidth: 1.5, borderColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  activityCardText: { color: '#2563eb', fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
