import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';

// The six daily field activities, exactly as the Kobo form presents them
// (same keys/order as its `topic` choice list) - this is the menu every
// field-activity role sees immediately after login. Names for govt/
// agriinput are shortened per feedback; each gets its own color so the
// grid is easy to scan at a glance.
const ACTIVITIES = [
  { key: 'training', label: 'Training', color: '#2563eb' },
  { key: 'fieldday', label: 'Field Day', color: '#0d9488' },
  { key: 'demoplot', label: 'Demo Plot', color: '#16a34a' },
  { key: 'adoption', label: 'Adoption Plot', color: '#d97706' },
  { key: 'govt', label: 'Institutional Visit', color: '#7c3aed' },
  { key: 'agriinput', label: 'Agro Dealer Visit', color: '#db2777' },
];

function ActivityCard({ label, color, onPress }) {
  return (
    <Pressable style={[styles.activityCard, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.activityCardText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Every role except TFO records day-to-day field activities here - TFO's
// entire role in this system (Phase 1) is viewing/resolving assigned
// issues (its own bottom tab); the six activities stay in the vendor app
// for TFO specifically.
export default function HomeScreen({ user, onFindDemoPlot }) {
  const showActivities = user.role !== 'tfo';

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
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}</Text>

      <Text style={styles.sectionLabel}>What are you monitoring today?</Text>
      <View style={styles.grid}>
        {ACTIVITIES.map((activity) => (
          <ActivityCard
            key={activity.key}
            label={activity.label}
            color={activity.color}
            onPress={() => handleActivity(activity)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingTop: 56, paddingBottom: 60 },
  centeredContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 32, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  activityCard: {
    width: '47%', minHeight: 90, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  activityCardText: { fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
