import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getIssue, listAssignableUsers, assignIssue, startIssue, resolveIssue, verifyIssue } from '../api';
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

export default function IssueDetailScreen({ token, user, issueId, onBack }) {
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState('');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getIssue(token, issueId);
      setIssue(data.issue);
      if (data.issue.status === 'raised') {
        const a = await listAssignableUsers(token, data.issue.village_id);
        setAssignableUsers(a.users);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, issueId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!issue) {
    return (
      <View style={styles.loading}>
        <Text style={styles.error}>{error || 'Issue not found.'}</Text>
      </View>
    );
  }

  const isAssignee = issue.assigned_to_id === user.id;
  const isRaiser = issue.raised_by_id === user.id;
  const colors = STATUS_COLORS[issue.status];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Back'}</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title}>{issue.issue_type_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusBadgeText, { color: colors.text }]}>{STATUS_LABELS[issue.status]}</Text>
        </View>
      </View>

      <Text style={styles.subLine}>{issue.farmer_name} ({issue.farmer_phone})</Text>
      <Text style={styles.subLine}>{issue.village_name}</Text>
      <Text style={styles.subLine}>Raised by {issue.raised_by_name} on {new Date(issue.created_at).toLocaleDateString()}</Text>
      <Text style={styles.subLine}>
        {issue.assigned_to_name ? `Assigned to ${issue.assigned_to_name}` : 'Not yet assigned'}
      </Text>

      {issue.photo_url && <Image source={{ uri: issue.photo_url }} style={styles.photo} />}

      {issue.resolution_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Resolution Note</Text>
          <Text style={styles.noteText}>{issue.resolution_note}</Text>
        </View>
      ) : null}
      {issue.rejection_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rejection Note</Text>
          <Text style={styles.noteText}>{issue.rejection_note}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isRaiser && issue.status === 'raised' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Assign To</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={assignedTo} onValueChange={setAssignedTo}>
              <Picker.Item label="-- select a person --" value="" />
              {assignableUsers.map((u) => <Picker.Item key={u.id} label={u.name} value={u.id} />)}
            </Picker>
          </View>
          <Pressable
            style={styles.actionButton}
            disabled={busy || !assignedTo}
            onPress={() => runAction(() => assignIssue(token, issue.id, assignedTo))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Assign</Text>}
          </Pressable>
        </View>
      )}

      {isAssignee && issue.status === 'assigned' && (
        <Pressable
          style={[styles.actionButton, styles.secondaryButton]}
          disabled={busy}
          onPress={() => runAction(() => startIssue(token, issue.id))}
        >
          {busy ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.secondaryButtonText}>Start Work</Text>}
        </Pressable>
      )}

      {isAssignee && ['assigned', 'in_progress'].includes(issue.status) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Resolution Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="What was done to resolve this"
            multiline
          />
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => runAction(() => resolveIssue(token, issue.id, note.trim() || undefined))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Mark Resolved</Text>}
          </Pressable>
        </View>
      )}

      {isRaiser && issue.status === 'pending_verification' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note (required if rejecting)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="Why this is being rejected, if it is"
            multiline
          />
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => runAction(() => verifyIssue(token, issue.id, true, note.trim() || undefined))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Verify & Close</Text>}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.dangerButton]}
            disabled={busy || !note.trim()}
            onPress={() => {
              if (!note.trim()) {
                Alert.alert('Note required', 'Explain why this is being rejected before reopening it.');
                return;
              }
              runAction(() => verifyIssue(token, issue.id, false, note.trim()));
            }}
          >
            <Text style={styles.dangerButtonText}>Reject & Reopen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  back: { color: COLORS.primary, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', flex: 1, marginRight: 8 },
  subLine: { color: '#555', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  photo: { width: '100%', height: 180, borderRadius: 8, marginTop: 16, backgroundColor: '#f1f5f9' },
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  noteText: { color: '#333' },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: COLORS.danger, marginTop: 16 },
  actionButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.primary, marginTop: 24 },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  dangerButton: { backgroundColor: COLORS.dangerSoft },
  dangerButtonText: { color: COLORS.danger, fontWeight: '700', fontSize: 16 },
});
