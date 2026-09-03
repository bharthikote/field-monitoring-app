import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { getTfoDemo, setTfoDemoStatus } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import BusinessPlanTab from '../components/BusinessPlanTab';
import { COLORS } from '../theme';

const CYCLE_LABELS = {
  demo_1: 'Demo 1', demo_2: 'Demo 2', demo_3: 'Demo 3', demo_4: 'Demo 4',
  adoption_1: 'Adoption 1', adoption_2: 'Adoption 2', adoption_3: 'Adoption 3', adoption_4: 'Adoption 4',
};
const IRRIGATION_LABELS = { hand_watering: 'Hand Watering', drip_irrigation: 'Drip Irrigation', sprinkler: 'Sprinkler', rainfed: 'Rain-fed' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};

// Monitoring tabs beyond Crop are deliberate skeletons for now (per spec) -
// each is built out into its own real section in a later pass.
const TABS = [
  { key: 'crop', label: 'Crop' },
  { key: 'business_plan', label: 'Business Plan' },
  { key: 'cost', label: 'Cost' },
  { key: 'return', label: 'Return' },
  { key: 'training', label: 'Training' },
  { key: 'field_day', label: 'Field Day' },
  { key: 'knowledge_acquisition', label: 'Knowledge Acquisition' },
];

// Values in the thousands abbreviate to "12.5K" (matching the reference
// screenshot); Profit can go negative (cost exceeds return), so the sign
// is preserved rather than clamped.
function formatKpiAmount(amount, currency) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return currency ? `${k}K ${currency}` : `${k}K`;
  }
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

// Cost = 0 has no meaningful "return per unit spent" - shown as 0% rather
// than Infinity/NaN, per spec.
function calcRoiPercent(costTotal, returnTotal) {
  if (!costTotal || costTotal <= 0) return 0;
  return Math.round((returnTotal / costTotal) * 100);
}

// A tiny Cost against a large Return produces a percentage with far more
// digits than the fixed 56x56 circle can lay out on one line (a real demo
// hit 20,000%+ and the text visibly overlapped) - capped display only,
// the underlying number (used for the fill-bar width, already clamped to
// 100 there) is untouched.
function formatRoiDisplay(percent) {
  return percent > 999 ? '999%+' : `${percent}%`;
}

function DetailField({ label, value }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? '—'}</Text>
    </View>
  );
}

// Mortality rate is a simple derived display value (seedlings vs.
// harvested), not a stored field or a real monitoring calculation - the
// spec is explicit that the actual progress/monitoring math comes later.
function mortalityRate(crop) {
  if (crop.no_harvested === null || !crop.no_of_seeding) return null;
  return `${Math.round((1 - crop.no_harvested / crop.no_of_seeding) * 100)}%`;
}

function CropDetailCard({ crop }) {
  return (
    <View style={styles.cropCard}>
      <Text style={styles.cropCardTitle}>Crop Detail - {crop.crop_name}</Text>

      <View style={styles.detailRow}>
        <DetailField label="Crop" value={crop.crop_name} />
        <DetailField label="Variety" value={crop.variety_name} />
        <DetailField label="Season" value={crop.season_name} />
      </View>
      <View style={styles.detailRow}>
        <DetailField label="Crop Area" value={`${crop.crop_area}m²`} />
        <DetailField label="No. of Seeding" value={crop.no_of_seeding} />
        <DetailField label="Sowing Date" value={crop.sowing_date} />
      </View>
      <View style={styles.detailRow}>
        <DetailField label="No. Transplanted" value={crop.no_transplanted} />
        <DetailField label="Transplant Date" value={crop.transplant_date} />
        <DetailField label="No. Harvested" value={crop.no_harvested} />
      </View>
      <View style={styles.detailRow}>
        <DetailField label="Harvest Date" value={crop.est_harvest_date} />
        <DetailField label="Mortality rate" value={mortalityRate(crop)} />
        <DetailField label="Irrigation" value={IRRIGATION_LABELS[crop.irrigation_system]} />
      </View>
    </View>
  );
}

// Reachable from both the Demos list and a Farmer Profile's Demo tab (see
// App.js's demoDetailOrigin) - this screen only ever takes a `demoId` and
// fetches its own data, so both entry points share the exact same
// component with no branching.
export default function TfoDemoDetailScreen({ token, user, demoId, onBack, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('crop');
  const [selectedCropIndex, setSelectedCropIndex] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [costTotal, setCostTotal] = useState(0);
  const [returnTotal, setReturnTotal] = useState(0);
  const [bpCurrency, setBpCurrency] = useState(null);
  const [production, setProduction] = useState('0');

  const handleBusinessPlanTotals = useCallback((cost, ret, currency, prod) => {
    setCostTotal(cost);
    setReturnTotal(ret);
    setBpCurrency(currency);
    setProduction(prod);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getTfoDemo(token, demoId);
      setData(result);
      setSelectedCropIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [demoId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = (newStatus, actionLabel) => {
    Alert.alert(
      `${actionLabel} Demo`,
      `Are you sure you want to mark this demo as ${STATUS_LABELS[newStatus]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: newStatus === 'terminated' ? 'destructive' : 'default',
          onPress: async () => {
            setStatusLoading(true);
            try {
              await setTfoDemoStatus(token, demoId, newStatus);
              setExpanded(false);
              await load();
            } catch (err) {
              Alert.alert('Something went wrong', err.message);
            } finally {
              setStatusLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={onBack} style={styles.header}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.error}>{error || 'Demo not found.'}</Text>
      </View>
    );
  }

  const { demo, crops } = data;
  const isOngoing = demo.status === 'ongoing';
  // A normal user can only move an ongoing demo forward; only Super Admin
  // can revert a Completed/Terminated demo back to Ongoing (which is what
  // reopens editing for everyone again) - see tfoDemos.js's POST .../status.
  const isSuperAdmin = user.role === 'super_admin';
  const selectedCrop = crops[selectedCropIndex] || null;
  const roiPercent = calcRoiPercent(costTotal, returnTotal);
  const profit = returnTotal - costTotal;

  const handleEditPress = () => {
    if (!isOngoing) {
      Alert.alert('Editing unavailable', `This demo is ${STATUS_LABELS[demo.status]} and can't be edited.`);
      return;
    }
    onEdit(data);
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityType}>Demo</Text>
              <Text style={styles.farmerName}>{demo.farmer_name}</Text>
            </View>
            <View style={styles.cardTopRight}>
              {crops.length > 1 ? (
                <View style={styles.cropSelectorWrap}>
                  <SearchableSelect
                    options={crops.map((c, i) => ({ id: String(i), name: c.crop_name }))}
                    value={String(selectedCropIndex)}
                    onChange={(v) => setSelectedCropIndex(Number(v))}
                  />
                </View>
              ) : (
                <View style={styles.cropChip}>
                  <Text style={styles.cropChipText}>{selectedCrop?.crop_name || '—'}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[demo.status].bg }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[demo.status].text }]}>
                  {STATUS_LABELS[demo.status]}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(Math.max(roiPercent, 0), 100)}%` }]} />
            <View style={styles.progressCircle}>
              <Text style={styles.progressText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRoiDisplay(roiPercent)}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Cost</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(costTotal, bpCurrency)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Production</Text>
              <Text style={styles.metricValue}>{production}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Return</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(returnTotal, bpCurrency)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Profit</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(profit, bpCurrency)}</Text>
            </View>
          </View>

          <Pressable style={styles.pill} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.pillText}>{expanded ? 'Show less' : 'Show more'}</Text>
          </Pressable>

          {expanded && (
            <View style={styles.actionsRow}>
              <Pressable style={styles.pill} onPress={handleEditPress}>
                <Text style={styles.pillText}>Edit</Text>
              </Pressable>
              {isOngoing && (
                <>
                  <Pressable style={styles.pill} onPress={() => changeStatus('completed', 'Complete')} disabled={statusLoading}>
                    <Text style={styles.pillText}>Complete</Text>
                  </Pressable>
                  <Pressable style={styles.pillDanger} onPress={() => changeStatus('terminated', 'Terminate')} disabled={statusLoading}>
                    <Text style={styles.pillDangerText}>Terminate</Text>
                  </Pressable>
                </>
              )}
              {!isOngoing && isSuperAdmin && (
                <Pressable style={styles.pill} onPress={() => changeStatus('ongoing', 'Reopen')} disabled={statusLoading}>
                  {statusLoading ? <ActivityIndicator size="small" color={COLORS.primaryDark} /> : <Text style={styles.pillText}>Reopen (Super Admin)</Text>}
                </Pressable>
              )}
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === 'crop' && (
          <>
            {selectedCrop ? <CropDetailCard crop={selectedCrop} /> : <Text style={styles.empty}>No crop details recorded.</Text>}
            <Pressable style={[styles.editButton, !isOngoing && styles.editButtonDisabled]} onPress={handleEditPress}>
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </>
        )}
        <BusinessPlanTab
          token={token}
          demoId={demoId}
          visible={activeTab === 'business_plan'}
          onTotalsChange={handleBusinessPlanTotals}
        />
        {activeTab === 'cost' || activeTab === 'return' || activeTab === 'training' ? (
          <Text style={styles.empty}>{TABS.find((t) => t.key === activeTab).label} isn't built yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 24, paddingBottom: 60 },
  header: { padding: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  error: { color: COLORS.danger, marginHorizontal: 24 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 14, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  activityType: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  farmerName: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark, marginTop: 2 },
  cardTopRight: { alignItems: 'flex-end', gap: 8 },
  cropSelectorWrap: { width: 150 },
  cropChip: { backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cropChipText: { color: COLORS.primaryDark, fontWeight: '600', fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  progressTrack: {
    height: 14, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 20, overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.primaryDark, borderRadius: 999,
  },
  progressCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: COLORS.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  progressText: { fontWeight: '700', color: COLORS.primaryDark, fontSize: 13 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'flex-start' },
  metricLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 15, marginTop: 2 },
  pill: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 16 },
  pillText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  pillDanger: { backgroundColor: COLORS.dangerSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 16 },
  pillDangerText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabScroll: { marginTop: 20, flexGrow: 0 },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#334155', fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: '#fff' },
  empty: { color: '#888', marginTop: 20 },
  cropCard: { marginTop: 20 },
  cropCardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark, marginBottom: 12 },
  detailRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  detailField: { flex: 1 },
  detailLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#2d2a26', marginTop: 2 },
  editButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start', marginTop: 8 },
  editButtonDisabled: { backgroundColor: '#cbd5c9' },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
