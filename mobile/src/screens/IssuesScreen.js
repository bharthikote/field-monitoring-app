import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listIssuesAssignedToMe, listIssuesRaisedByMe } from '../api';
import { COLORS } from '../theme';

const STATUS_LABELS = {
  raised: 'Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_verification: 'Pending Verification',
  closed: 'Closed',
};
const STATUS_COLORS = {
  raised: { bg: '#f1f5f9', text: '#334155' },
  assigned: { bg: '#fef3c7', text: '#92400e' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  pending_verification: { bg: '#ede9fe', text: '#5b21b6' },
  closed: { bg: '#dcfce7', text: '#166534' },
};

const CAN_BE_ASSIGNEE = ['tfo', 'supervisor', 'team_lead'];
const CAN_RAISE = ['country_manager', 'team_lead', 'supervisor'];

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusBadgeText, { color: colors.text }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function IssueCard({ issue, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{issue.issue_type_name}</Text>
        <StatusBadge status={issue.status} />
      </View>
      <Text style={styles.cardLine}>{issue.farmer_name} — {issue.village_name}</Text>
      <Text style={styles.cardMeta}>
        {issue.assigned_to_name ? `Assigned to ${issue.assigned_to_name}` : 'Not yet assigned'}
      </Text>
      <Text style={styles.cardMeta}>{new Date(issue.created_at).toLocaleDateString()}</Text>
    </Pressable>
  );
}

export default function IssuesScreen({ token, user, onSelectIssue }) {
  const canBeAssignee = CAN_BE_ASSIGNEE.includes(user.role);
  const canRaise = CAN_RAISE.includes(user.role);
  const [tab, setTab] = useState(canBeAssignee ? 'assigned' : 'raised');
  const [assignedIssues, setAssignedIssues] = useState([]);
  const [raisedIssues, setRaisedIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [];
      if (canBeAssignee) calls.push(listIssuesAssignedToMe(token).then((d) => setAssignedIssues(d.issues)));
      if (canRaise) calls.push(listIssuesRaisedByMe(token).then((d) => setRaisedIssues(d.issues)));
      await Promise.all(calls);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, canBeAssignee, canRaise]);

  useEffect(() => {
    load();
  }, [load]);

  const activeIssues = tab === 'assigned' ? assignedIssues : raisedIssues;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Issues</Text>
      </View>

      {canBeAssignee && canRaise && (
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'assigned' && styles.tabActive]} onPress={() => setTab('assigned')}>
            <Text style={[styles.tabText, tab === 'assigned' && styles.tabTextActive]}>Assigned to Me</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'raised' && styles.tabActive]} onPress={() => setTab('raised')}>
            <Text style={[styles.tabText, tab === 'raised' && styles.tabTextActive]}>Raised by Me</Text>
          </Pressable>
        </View>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && activeIssues.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}

      <FlatList
        data={activeIssues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <IssueCard issue={item} onPress={() => onSelectIssue(item.id)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 24, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  list: { padding: 24, paddingTop: 8 },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  empty: { color: '#888', marginTop: 12, marginHorizontal: 24 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  cardLine: { color: '#333', marginTop: 4 },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});
