import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { listIssuesAssignedToMe, bulkVerifyIssues } from '../api';
import { COLORS } from '../theme';

const BATCH_SIZE = 10;
const MAX_PER_REQUEST = 100;

// Everything a Supervisor (or Country Manager) is currently being asked to
// verify, in one list - approve many in one go instead of opening each
// issue. Approve only: rejecting needs a note per issue, so that stays a
// one-at-a-time action from the issue's own screen (Details).
export default function BulkVerifyScreen({ token, onBack, onOpenIssue }) {
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listIssuesAssignedToMe(token);
      setIssues(data.issues.filter((i) => i.status === 'pending_verification'));
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(issues.map((i) => i.id)));
  const selectBatch = () => setSelected(new Set(issues.slice(0, BATCH_SIZE).map((i) => i.id)));
  const clearSelection = () => setSelected(new Set());
  const allSelected = issues.length > 0 && selected.size === issues.length;

  const submit = async () => {
    const ids = [...selected];
    setSubmitting(true);
    setError('');
    try {
      let closed = 0;
      let skipped = 0;
      for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
        const result = await bulkVerifyIssues(token, ids.slice(i, i + MAX_PER_REQUEST));
        closed += result.closed;
        skipped += result.skipped;
      }
      Alert.alert(
        'Done',
        skipped > 0
          ? `${closed} closed. ${skipped} were skipped (already handled).`
          : `${closed} ${closed === 1 ? 'issue' : 'issues'} verified and closed.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmit = () => {
    const count = selected.size;
    Alert.alert(
      `Verify & close ${count} ${count === 1 ? 'issue' : 'issues'}?`,
      'This confirms each one was genuinely resolved. To reject one instead, open it with Details.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify & Close', onPress: submit },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Verify Resolved Issues</Text>
        {!loading && <Text style={styles.subtitle}>{issues.length} waiting for you</Text>}
      </View>

      {issues.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable style={styles.toolButton} onPress={selectBatch}>
            <Text style={styles.toolButtonText}>Select {BATCH_SIZE}</Text>
          </Pressable>
          <Pressable style={styles.toolButton} onPress={allSelected ? clearSelection : selectAll}>
            <Text style={styles.toolButtonText}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
          </Pressable>
          {selected.size > 0 && !allSelected && (
            <Pressable style={styles.toolButton} onPress={clearSelection}>
              <Text style={styles.toolButtonText}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && issues.length === 0 && <Text style={styles.empty}>Nothing is waiting for your verification.</Text>}

      <FlatList
        data={issues}
        extraData={selected}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable style={[styles.row, isSelected && styles.rowSelected]} onPress={() => toggle(item.id)}>
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Text style={styles.tick}>✓</Text>}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.issue_type_name}</Text>
                <Text style={styles.rowLine}>{item.farmer_name} — {item.village_name}</Text>
                <Text style={styles.rowMeta}>Resolved by {item.resolved_by_name || 'unknown'}</Text>
                {item.resolution_note ? <Text style={styles.rowNote} numberOfLines={2}>"{item.resolution_note}"</Text> : null}
              </View>
              <Pressable onPress={() => onOpenIssue(item.id)} hitSlop={8}>
                <Text style={styles.detailsLink}>Details</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />

      {selected.size > 0 && (
        <View style={styles.footer}>
          <Pressable style={styles.verifyButton} onPress={confirmSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Close {selected.size} selected</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 8 },
  back: { color: COLORS.primary, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#555', marginTop: 4 },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginVertical: 8 },
  toolButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9' },
  toolButtonText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  list: { padding: 24, paddingTop: 8, paddingBottom: 100 },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  empty: { color: '#888', marginTop: 12, marginHorizontal: 24 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#e2e2e2',
    borderRadius: 10, padding: 14, marginBottom: 10, backgroundColor: '#fff',
  },
  rowSelected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowLine: { color: '#333', marginTop: 2 },
  rowMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  rowNote: { color: '#555', fontStyle: 'italic', fontSize: 13, marginTop: 4 },
  detailsLink: { color: COLORS.primary, fontWeight: '600', fontSize: 13, marginLeft: 8 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e2e2',
  },
  verifyButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  verifyButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
