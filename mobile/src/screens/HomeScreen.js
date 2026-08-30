import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { clearSession } from '../session';
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
// this system (Phase 1) is viewing/resolving assigned issues; the other
// five activities stay in the vendor app for them.
const ACTIVITY_ROLES = ['supervisor', 'team_lead', 'country_manager'];
const CAN_USE_ISSUES = ['tfo', 'supervisor', 'team_lead', 'country_manager'];

function ActivityCard({ label, onPress }) {
  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <Text style={styles.activityCardText}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ user, onLoggedOut, onFindDemoPlot, onGoToIssues }) {
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label || user.role;
  const showActivities = ACTIVITY_ROLES.includes(user.role);
  const canUseIssues = CAN_USE_ISSUES.includes(user.role);

  const handleLogout = async () => {
    await clearSession();
    onLoggedOut();
  };

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

        {canUseIssues && (
          <Pressable style={styles.primaryButton} onPress={onGoToIssues}>
            <Text style={styles.primaryButtonText}>Issues</Text>
          </Pressable>
        )}

        <Pressable style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Welcome, {user.name}</Text>
          <Text style={styles.subtitle}>{roleLabel}</Text>
          <Text style={styles.userCode}>ID: {user.userCode}</Text>
        </View>
        <Pressable onPress={handleLogout}>
          <Text style={styles.logoutLink}>Log Out</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>What are you monitoring today?</Text>
      <View style={styles.grid}>
        {ACTIVITIES.map((activity) => (
          <ActivityCard key={activity.key} label={activity.label} onPress={() => handleActivity(activity)} />
        ))}
      </View>

      {canUseIssues && (
        <Pressable style={styles.issuesButton} onPress={onGoToIssues}>
          <Text style={styles.issuesButtonText}>Issues</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  centeredContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#555', marginTop: 4 },
  userCode: { fontSize: 13, color: '#888', marginTop: 4, fontFamily: 'monospace' },
  logoutLink: { color: '#dc2626', fontWeight: '600', fontSize: 14, marginTop: 4 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 32, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  activityCard: {
    width: '47%', minHeight: 90, borderRadius: 10, borderWidth: 1.5, borderColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  activityCardText: { color: '#2563eb', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  issuesButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 32 },
  issuesButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, paddingHorizontal: 28, marginBottom: 16, marginTop: 32 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
