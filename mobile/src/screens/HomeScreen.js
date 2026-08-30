import { View, Text, Pressable, StyleSheet } from 'react-native';
import { clearSession } from '../session';
import { ROLES } from '../roles';

// Everyone who can raise an issue or be assigned one - covers every
// mobile-first role, including TFO, whose entire role in this system
// (Phase 1) is logging in to view and resolve assigned issues.
const CAN_USE_ISSUES = ['tfo', 'supervisor', 'team_lead', 'country_manager'];

export default function HomeScreen({ user, onLoggedOut, onFindDemoPlot, onGoToIssues }) {
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label || user.role;
  const canUseDemoPlots = user.role !== 'tfo';
  const canUseIssues = CAN_USE_ISSUES.includes(user.role);

  const handleLogout = async () => {
    await clearSession();
    onLoggedOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}</Text>
      <Text style={styles.subtitle}>{roleLabel}</Text>
      <Text style={styles.userCode}>ID: {user.userCode}</Text>

      {canUseDemoPlots && (
        <Pressable style={styles.primaryButton} onPress={onFindDemoPlot}>
          <Text style={styles.primaryButtonText}>Find / Create Demo Plot</Text>
        </Pressable>
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#555', marginTop: 4 },
  userCode: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 32, fontFamily: 'monospace' },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, paddingHorizontal: 28, marginBottom: 16 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
