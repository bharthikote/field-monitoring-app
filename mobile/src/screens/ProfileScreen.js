import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { clearSession } from '../session';
import { ROLES } from '../roles';
import { COLORS } from '../theme';

function initialsFor(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function IdIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <Path d="M7 11h.01M7 15h.01M11 11h6M11 15h4" />
    </Svg>
  );
}

function PhoneIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </Svg>
  );
}

function Field({ icon, label, value, last }) {
  return (
    <View style={[styles.fieldRow, last && styles.fieldRowLast]}>
      <View style={styles.fieldIcon}>{icon}</View>
      <View style={styles.fieldTextWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
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
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(user.name)}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Field icon={<IdIcon color={COLORS.primary} />} label="User ID" value={user.userCode} />
        <Field icon={<PhoneIcon color={COLORS.primary} />} label="Contact" value={user.mobileNumber || user.email} last />
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#111' },
  roleBadge: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  roleBadgeText: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldIcon: { width: 28, alignItems: 'center' },
  fieldTextWrap: { flex: 1 },
  fieldLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 2 },
  fieldValue: { fontSize: 16, color: '#111' },
  logoutButton: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 28,
  },
  logoutButtonText: { color: COLORS.danger, fontWeight: '600', fontSize: 16 },
});
