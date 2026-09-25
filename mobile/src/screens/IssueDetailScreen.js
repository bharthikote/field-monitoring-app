import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getIssue, listAssignableUsers, assignIssue, startIssue, resolveIssue, verifyIssue,
  disputeIssue, reviewDispute, listReassignableUsers, reassignIssue, listReassignments,
  acknowledgeIssue,
} from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { ROLES } from '../roles';
import { COLORS } from '../theme';

const STATUS_LABELS = {
  raised: 'Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_verification: 'Pending Verification',
  disputed: 'Disputed',
  closed: 'Closed',
  dismissed: 'Dismissed',
};
const STATUS_COLORS = {
  raised: { bg: '#f1f5f9', text: '#334155' },
  assigned: { bg: '#fef3c7', text: '#92400e' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  pending_verification: { bg: '#ede9fe', text: '#5b21b6' },
  disputed: { bg: '#ffedd5', text: '#9a3412' },
  closed: { bg: '#dcfce7', text: '#166534' },
  dismissed: { bg: '#f3f4f6', text: '#4b5563' },
};

export default function IssueDetailScreen({ token, user, issueId, onBack }) {
  const [issue, setIssue] = useState(null);
  const [reassignments, setReassignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState('');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');

  const [showReassign, setShowReassign] = useState(false);
  const [reassignableUsers, setReassignableUsers] = useState([]);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignComment, setReassignComment] = useState('');

  const [showDispute, setShowDispute] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getIssue(token, issueId);
      setIssue(data.issue);
      if (data.issue.status === 'raised') {
        const a = await listAssignableUsers(token, data.issue.village_id, data.issue.id);
        setAssignableUsers(a.users);
      }
      if (['assigned', 'in_progress'].includes(data.issue.status) && data.issue.assigned_to_id === user.id) {
        const r = await listReassignableUsers(token, data.issue.village_id);
        setReassignableUsers(r.users);
      }
      const rs = await listReassignments(token, issueId);
      setReassignments(rs.reassignments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, issueId, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setNote('');
      setReassignComment('');
      setDisputeNote('');
      setShowReassign(false);
      setShowDispute(false);
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
  const canAct = isAssignee && ['assigned', 'in_progress'].includes(issue.status);
  // Acknowledge-only issues (a fact about the site, like a plot not visible
  // from the main road) have nothing to start or resolve - the holder just
  // acknowledges, which closes it. And whoever raised an issue can't dispute
  // it, e.g. when it's been reassigned back to him.
  const acknowledgeOnly = !!issue.acknowledge_only;
  const canDispute = canAct && !isRaiser;
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
        {issue.assigned_to_name ? `Currently with ${issue.assigned_to_name}` : 'Not yet assigned'}
      </Text>

      {issue.photo_url && <Image source={{ uri: issue.photo_url }} style={styles.photo} />}

      {reassignments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reassignment History</Text>
          {reassignments.map((r) => (
            <View key={r.id} style={styles.historyRow}>
              <Text style={styles.noteText}>{r.from_name} → {r.to_name}</Text>
              <Text style={styles.historyComment}>"{r.comment}"</Text>
              <Text style={styles.historyDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}

      {issue.resolution_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Resolution Note{issue.resolved_by_name ? ` — ${issue.resolved_by_name}` : ''}</Text>
          <Text style={styles.noteText}>{issue.resolution_note}</Text>
        </View>
      ) : null}
      {issue.dispute_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dispute Note{issue.disputed_by_name ? ` — ${issue.disputed_by_name}` : ''}</Text>
          <Text style={styles.noteText}>{issue.dispute_note}</Text>
        </View>
      ) : null}
      {issue.dismissal_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dismissal Note</Text>
          <Text style={styles.noteText}>{issue.dismissal_note}</Text>
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

      {isAssignee && issue.status === 'assigned' && !acknowledgeOnly && (
        <Pressable
          style={[styles.actionButton, styles.secondaryButton]}
          disabled={busy}
          onPress={() => runAction(() => startIssue(token, issue.id))}
        >
          {busy ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.secondaryButtonText}>Start Work</Text>}
        </Pressable>
      )}

      {canAct && acknowledgeOnly && (
        <View style={styles.section}>
          <Text style={styles.noteText}>
            This is something that can't be fixed on site - acknowledging it closes it.
          </Text>
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="Anything worth recording"
            multiline
          />
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => runAction(() => acknowledgeIssue(token, issue.id, note.trim() || undefined))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Acknowledge & Close</Text>}
          </Pressable>
        </View>
      )}

      {canAct && !acknowledgeOnly && (
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

      {canAct && !showReassign && (
        <Pressable style={styles.linkRow} onPress={() => setShowReassign(true)}>
          <Text style={styles.linkText}>Not your responsibility? Reassign it</Text>
        </Pressable>
      )}
      {canAct && showReassign && (
        <View style={styles.section}>
          <SearchableSelect
            label="Reassign To"
            placeholder="Search who's actually responsible"
            options={reassignableUsers.map((u) => ({
              id: u.id,
              name: `${u.name} (${ROLES.find((r) => r.value === u.role)?.label || u.role})`,
            }))}
            value={reassignTo}
            onChange={setReassignTo}
          />
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Comment (required)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={reassignComment}
            onChangeText={setReassignComment}
            placeholder="Why this isn't yours to fix"
            multiline
          />
          <Pressable
            style={[styles.actionButton, styles.secondaryButton]}
            disabled={busy || !reassignTo || !reassignComment.trim()}
            onPress={() => runAction(() => reassignIssue(token, issue.id, reassignTo, reassignComment.trim()))}
          >
            {busy ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.secondaryButtonText}>Reassign</Text>}
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => setShowReassign(false)}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {canDispute && !showDispute && (
        <Pressable style={styles.linkRow} onPress={() => setShowDispute(true)}>
          <Text style={styles.linkText}>Not sure this is genuine? Dispute it</Text>
        </Pressable>
      )}
      {canDispute && showDispute && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dispute Note (required)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={disputeNote}
            onChangeText={setDisputeNote}
            placeholder="Why you think this isn't a real issue"
            multiline
          />
          <Pressable
            style={[styles.actionButton, styles.dangerButton]}
            disabled={busy || !disputeNote.trim()}
            onPress={() => runAction(() => disputeIssue(token, issue.id, disputeNote.trim()))}
          >
            {busy ? <ActivityIndicator color={COLORS.danger} /> : <Text style={styles.dangerButtonText}>Send to Supervisor for Review</Text>}
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => setShowDispute(false)}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {isAssignee && issue.status === 'pending_verification' && (
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

      {isAssignee && issue.status === 'disputed' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Review</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="Note (required if dismissing as not genuine)"
            multiline
          />
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => runAction(() => reviewDispute(token, issue.id, true, note.trim() || undefined))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Genuine — Resolve & Close</Text>}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.dangerButton]}
            disabled={busy || !note.trim()}
            onPress={() => {
              if (!note.trim()) {
                Alert.alert('Note required', 'Explain why this is being dismissed as not genuine.');
                return;
              }
              runAction(() => reviewDispute(token, issue.id, false, note.trim()));
            }}
          >
            <Text style={styles.dangerButtonText}>Not Genuine — Dismiss</Text>
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
  historyRow: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 8 },
  historyComment: { color: '#555', fontStyle: 'italic', marginTop: 2 },
  historyDate: { color: '#999', fontSize: 12, marginTop: 2 },
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
  linkRow: { marginTop: 16, alignItems: 'center' },
  linkText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
