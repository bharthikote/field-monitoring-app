import { View, Text, Pressable, StyleSheet } from 'react-native';
import { clearSession } from '../session';
import { ROLES } from '../roles';
import { COLORS } from '../theme';

function Field({ label, value }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen({ user, onLoggedOut }) {
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label || user.role;

  const handleLogout = async () => {
    await clearSession();
    onLoggedOut();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Field label="Name" value={user.name} />
        <Field label="Role" value={roleLabel} />
        <Field label="User ID" value={user.userCode} />
        <Field label="Contact" value={user.mobileNumber || user.email} />
      </View>

      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 4 },
  fieldRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  fieldLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 3 },
  fieldValue: { fontSize: 16, color: '#111' },
  button: { backgroundColor: COLORS.danger, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
