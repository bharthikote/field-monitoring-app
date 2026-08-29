import { View, Text, Pressable, StyleSheet } from 'react-native';
import { clearSession } from '../session';
import { ROLES } from '../roles';

export default function HomeScreen({ user, onLoggedOut }) {
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label || user.role;

  const handleLogout = async () => {
    await clearSession();
    onLoggedOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}</Text>
      <Text style={styles.subtitle}>{roleLabel}</Text>
      <Text style={styles.userCode}>ID: {user.userCode}</Text>

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
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
