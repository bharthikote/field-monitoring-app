import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { listVisits } from '../api';
import { COLORS } from '../theme';
import LogVisitScreen from './LogVisitScreen';

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
      <View style={styles.visitHeaderRow}>
        <Text style={styles.visitDate}>{new Date(visit.created_at).toLocaleString()}</Text>
        <Text style={styles.visitBy}>{visit.visited_by_name}</Text>
      </View>

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

      {visit.techniques?.length > 0 && (
        <>
          <Text style={styles.visitSectionLabel}>Techniques Adopted</Text>
          <View style={styles.chipRow}>
            {visit.techniques.map((t) => <Chip key={t.name} label={t.name} />)}
          </View>
        </>
      )}

      {visit.diseases?.length > 0 && (
        <>
          <Text style={styles.visitSectionLabel}>Diseases Observed</Text>
          <View style={styles.chipRow}>
            {visit.diseases.map((d, i) => <Chip key={`${d.name}-${i}`} label={d.name} />)}
          </View>
        </>
      )}

      {visit.pests?.length > 0 && (
        <>
          <Text style={styles.visitSectionLabel}>Pests Observed</Text>
          <View style={styles.chipRow}>
            {visit.pests.map((p, i) => <Chip key={`${p.name}-${i}`} label={p.name} />)}
          </View>
        </>
      )}

      <Text style={styles.visitSectionLabel}>Action Plan</Text>
      <Text style={styles.visitLine}>{visit.action_plan}</Text>
      <Text style={styles.visitSectionLabel}>Remarks</Text>
      <Text style={styles.visitLine}>{visit.comments}</Text>

      <Image source={{ uri: visit.overall_photo_url }} style={styles.photo} />
    </View>
  );
}

export default function DemoPlotDetailScreen({ token, plot, onBack }) {
  const [tab, setTab] = useState('log-visit');
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

  const handleVisitLogged = () => {
    setTab('history');
    load();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>

        <View style={styles.infoBox}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{plot.farmer_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[plot.demo_status].bg }]}>
              <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[plot.demo_status].text }]}>
                {STATUS_LABELS[plot.demo_status]}
              </Text>
            </View>
          </View>
          <Text style={styles.subLine}>{plot.farmer_phone}</Text>
          <View style={styles.bottomRow}>
            <Text style={styles.cropLine}>{plot.crop_name} — {plot.variety_name}</Text>
            <Text style={styles.villageLine}>{plot.village_name}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'log-visit' && styles.tabActive]} onPress={() => setTab('log-visit')}>
            <Text style={[styles.tabText, tab === 'log-visit' && styles.tabTextActive]}>Log Visit</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Visit History</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'log-visit' && (
        <LogVisitScreen token={token} plot={plot} onSubmitted={handleVisitLogged} />
      )}

      {tab === 'history' && (
        <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContainer}>
          {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && visits && visits.length === 0 && (
            <Text style={styles.empty}>No visits logged yet.</Text>
          )}
          {visits && visits.map((v) => <VisitCard key={v.id} visit={v} />)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 24, paddingBottom: 10 },
  back: { color: COLORS.primary, marginBottom: 16 },
  infoBox: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', flex: 1, marginRight: 8 },
  subLine: { color: '#555', marginTop: 4, fontSize: 13 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  cropLine: { color: '#555', fontSize: 13, flex: 1, marginRight: 8 },
  villageLine: { color: '#555', fontSize: 13, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  historyScroll: { flex: 1 },
  historyContainer: { padding: 24, paddingTop: 16, paddingBottom: 60 },
  error: { color: COLORS.danger, marginTop: 12 },
  empty: { color: '#888' },
  visitCard: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 12 },
  visitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  visitDate: { fontWeight: '700', fontSize: 14, flex: 1, marginRight: 8 },
  visitBy: { color: '#888', fontSize: 12, textAlign: 'right' },
  visitSectionLabel: { fontSize: 11, color: '#888', fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  visitLine: { color: '#333', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, color: '#334155' },
  photo: { width: '100%', height: 180, borderRadius: 8, marginTop: 10, backgroundColor: '#f1f5f9' },
});
