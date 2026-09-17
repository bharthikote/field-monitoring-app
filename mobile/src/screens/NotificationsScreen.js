import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import { COLORS } from '../theme';

const TYPE_LABELS = {
  issue_assigned: 'Assigned',
  issue_resolved: 'Resolved',
  issue_verified: 'Verified',
  issue_reopened: 'Reopened',
};

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationCard({ item, onPress }) {
  return (
    <Pressable style={[styles.card, !item.read && styles.cardUnread]} onPress={onPress}>
      {!item.read && <View style={styles.dot} />}
      <View style={styles.cardBody}>
        <Text style={styles.cardType}>{TYPE_LABELS[item.type] || 'Update'}</Text>
        <Text style={styles.cardMessage}>{item.message}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen({ token, onBack, onSelectIssue }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listNotifications(token);
      setNotifications(data.notifications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = async (item) => {
    if (!item.read) {
      markNotificationRead(token, item.id).catch(() => {});
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    if (item.issue_id) onSelectIssue(item.issue_id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead(token).catch(() => {});
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {hasUnread ? (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && notifications.length === 0 && <Text style={styles.empty}>No notifications yet.</Text>}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <NotificationCard item={item} onPress={() => handlePress(item)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: COLORS.primary },
  title: { fontSize: 18, fontWeight: '700' },
  markAllRead: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  list: { padding: 24, paddingTop: 8 },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  empty: { color: '#888', marginTop: 12, marginHorizontal: 24 },
  card: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10,
    padding: 14, marginBottom: 12, backgroundColor: '#fff',
  },
  cardUnread: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primarySoft },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 10, marginTop: 6 },
  cardBody: { flex: 1 },
  cardType: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark, textTransform: 'uppercase', marginBottom: 2 },
  cardMessage: { color: '#333', fontSize: 14 },
  cardTime: { color: '#888', fontSize: 12, marginTop: 4 },
});
