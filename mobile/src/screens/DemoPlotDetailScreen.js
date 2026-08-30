import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { listVisits } from '../api';
import { COLORS } from '../theme';

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};

function Chip({ label }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function VisitCard({ visit }) {
  return (
    <View style={styles.visitCard}>
      <Text style={styles.visitDate}>{new Date(visit.created_at).toLocaleString()}</Text>
      <Text style={styles.visitBy}>Logged by {visit.visited_by_name}</Text>

      {visit.issues.length > 0 && (
        <>
          <Text style={styles.visitSectionLabel}>Issues Observed</Text>
          <View style={styles.chipRow}>
            {visit.issues.map((i) => <Chip key={i.name} label={i.name} />)}
          </View>
        </>
      )}

      {visit.goodThings.length > 0 && (
        <>
          <Text style={styles.visitSectionLabel}>Good Things Observed</Text>
          <View style={styles.chipRow}>
            {visit.goodThings.map((g) => <Chip key={g.name} label={g.name} />)}
          </View>
        </>
      )}

      {visit.disease_name || visit.disease_other ? (
        <Text style={styles.visitLine}>Disease: {visit.disease_name || visit.disease_other}</Text>
      ) : null}
      {visit.pest_name || visit.pest_other ? (
        <Text style={styles.visitLine}>Pest: {visit.pest_name || visit.pest_other}</Text>
      ) : null}

      <Text style={styles.visitSectionLabel}>Action Plan</Text>
      <Text style={styles.visitLine}>{visit.action_plan}</Text>
      <Text style={styles.visitSectionLabel}>Remarks</Text>
      <Text style={styles.visitLine}>{visit.comments}</Text>

      <Image source={{ uri: visit.overall_photo_url }} style={styles.photo} />
    </View>
  );
}

const CAN_RAISE_ISSUES = ['country_manager', 'team_lead', 'supervisor'];

export default function DemoPlotDetailScreen({ token, user, plot, onBack, onLogVisit, onRaiseIssue }) {
  const [visits, setVisits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listVisits(token, plot.id);
      setVisits(data.visits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [plot.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <Text style={styles.title}>{plot.farmer_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[plot.demo_status].bg }]}>
            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[plot.demo_status].text }]}>
              {STATUS_LABELS[plot.demo_status]}
            </Text>
          </View>
        </View>
        <Text style={styles.subLine}>{plot.farmer_phone}</Text>
        <Text style={styles.subLine}>{plot.crop_name} — {plot.variety_name}</Text>
        <Text style={styles.subLine}>{plot.village_name}</Text>

        <Pressable style={styles.logVisitButton} onPress={() => onLogVisit(plot)}>
          <Text style={styles.logVisitButtonText}>Log a Visit</Text>
        </Pressable>

        {CAN_RAISE_ISSUES.includes(user.role) && (
          <Pressable style={styles.raiseIssueButton} onPress={() => onRaiseIssue(plot)}>
            <Text style={styles.raiseIssueButtonText}>Raise an Issue</Text>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>Visit History</Text>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && visits && visits.length === 0 && (
          <Text style={styles.empty}>No visits logged yet.</Text>
        )}
        {visits && visits.map((v) => <VisitCard key={v.id} visit={v} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  back: { color: COLORS.primary, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', flex: 1, marginRight: 8 },
  subLine: { color: '#555', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  logVisitButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  logVisitButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  raiseIssueButton: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 10,
  },
  raiseIssueButtonText: { color: COLORS.danger, fontWeight: '600', fontSize: 16 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 28, marginBottom: 8, textTransform: 'uppercase' },
  error: { color: COLORS.danger, marginTop: 12 },
  empty: { color: '#888' },
  visitCard: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 12 },
  visitDate: { fontWeight: '700', fontSize: 14 },
  visitBy: { color: '#888', fontSize: 12, marginTop: 2, marginBottom: 8 },
  visitSectionLabel: { fontSize: 11, color: '#888', fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  visitLine: { color: '#333', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, color: '#334155' },
  photo: { width: '100%', height: 180, borderRadius: 8, marginTop: 10, backgroundColor: '#f1f5f9' },
});
