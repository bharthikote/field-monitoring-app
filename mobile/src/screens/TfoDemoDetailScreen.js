import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { getTfoDemo, setTfoDemoStatus } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import BusinessPlanTab from '../components/BusinessPlanTab';
import ActualCostTab from '../components/ActualCostTab';
import ActualReturnTab from '../components/ActualReturnTab';
import { COLORS } from '../theme';

const CYCLE_LABELS = {
  demo_1: 'Demo 1', demo_2: 'Demo 2', demo_3: 'Demo 3', demo_4: 'Demo 4',
  adoption_1: 'Adoption 1', adoption_2: 'Adoption 2', adoption_3: 'Adoption 3', adoption_4: 'Adoption 4',
};
const IRRIGATION_LABELS = { hand_watering: 'Hand Watering', drip_irrigation: 'Drip Irrigation', sprinkler: 'Sprinkler', rainfed: 'Rain-fed' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
// Ongoing matches the screenshot exactly - the same solid orange used for
// the Business Plan active tab/indicator elsewhere in this app.
const STATUS_COLORS = {
  ongoing: { bg: '#f2994a', text: '#fff' },
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
// is preserved rather than clamped. No currency suffix here - the
// reference screenshots never show one on the KPI card itself (unlike the
// Cost/Return tab bodies, which do label each amount).
function formatKpiAmount(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}K`;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  // The KPI card reflects ACTUAL performance, not the Business Plan's
  // expected/planned figures - Actual Cost/Return are the source of truth
  // here (Business Plan no longer reports totals up at all).
  const [costTotal, setCostTotal] = useState(0);
  const [returnTotal, setReturnTotal] = useState(0);
  const [production, setProduction] = useState('0');

  const handleActualCostTotal = useCallback((cost) => {
    setCostTotal(cost);
  }, []);
  const handleActualReturnTotal = useCallback((ret, currency, prod) => {
    setReturnTotal(ret);
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
                    compact
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

          <View style={styles.progressOuter}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(Math.max(roiPercent, 0), 100)}%` }]} />
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRoiDisplay(roiPercent)}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Cost</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(costTotal)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Production</Text>
              <Text style={styles.metricValue}>{production}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Return</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(returnTotal)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Profit</Text>
              <Text style={styles.metricValue}>{formatKpiAmount(profit)}</Text>
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
        {activeTab === 'business_plan' && <BusinessPlanTab token={token} demoId={demoId} />}

        {/* Always mounted (hidden via style, not unmounted) once the demo
            loads, regardless of which tab is visible - the KPI card above
            needs live Actual Cost/Return totals from the moment the
            screen opens, not just once the user taps into Cost/Return. */}
        <View style={activeTab === 'cost' ? undefined : styles.hidden}>
          <ActualCostTab token={token} demoId={demoId} onTotalChange={handleActualCostTotal} />
        </View>
        <View style={activeTab === 'return' ? undefined : styles.hidden}>
          <ActualReturnTab token={token} demoId={demoId} onTotalChange={handleActualReturnTotal} />
        </View>

        {activeTab === 'training' || activeTab === 'field_day' || activeTab === 'knowledge_acquisition' ? (
          <Text style={styles.empty}>{TABS.find((t) => t.key === activeTab).label} isn't built yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The card stays white and stands out against this slightly tinted
  // screen background (the app's existing COLORS.bg, already used as a
  // subtle panel tint elsewhere) - gives the "above the card / below the
  // card" areas a visible distinction instead of both being flat white.
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 24, paddingBottom: 60 },
  header: { padding: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  error: { color: COLORS.danger, marginHorizontal: 24 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 14, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  activityType: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  farmerName: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark, marginTop: 2 },
  // flexShrink: 0 so a long farmer name can never compress this column
  // leftward - the most plausible cause of "crop selector positioned too
  // far left" from code inspection alone (not visually confirmed, no
  // device available).
  cardTopRight: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  // No fixed width at all now - sizes to the crop name's actual text
  // length (neither this wrapper nor SearchableSelect's own Pressable set
  // a width, and cardTopRight's alignItems: 'flex-end' - not 'stretch' -
  // means a child with no explicit width naturally shrinks to its content
  // instead of filling available space). A fixed pixel guess (150, then
  // 90) was always going to be wrong for some crop name length; this
  // isn't.
  cropSelectorWrap: {},
  cropChip: { backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cropChipText: { color: COLORS.primaryDark, fontWeight: '600', fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  // progressTrack only ever holds the fill bar now, and only IT gets
  // overflow: hidden (needed to clip the fill to the track's rounded
  // corners) - progressCircle used to be a child of this same clipped
  // box, which cut its 56px height down to the track's 14px, leaving
  // only a flat sliver with no visible circular border. It's now a
  // sibling of the track inside progressOuter (unclipped), so it renders
  // at full size regardless of how thin the track is.
  progressOuter: { height: 64, marginTop: 24, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    width: '100%', height: 28, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.primaryDark, borderRadius: 999,
  },
  progressCircle: {
    position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
    borderWidth: 2, borderColor: COLORS.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  progressText: { fontWeight: '700', color: COLORS.primaryDark, fontSize: 14 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'flex-start' },
  metricLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 15, marginTop: 2 },
  pill: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 16 },
  pillText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  // alignSelf: 'flex-start' matters here specifically because this pill
  // sits inside actionsRow (a row with no alignItems set, so it defaults
  // to 'stretch') alongside .pill buttons that already override that
  // default themselves - without it, Terminate stretched to the row's
  // full cross-axis height while Edit/Complete didn't, visibly sitting
  // lower than them.
  pillDanger: { backgroundColor: COLORS.dangerSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 16, alignSelf: 'flex-start' },
  pillDangerText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  // marginTop separates this row from the "Show less" pill directly above
  // it - without it there was zero gap between them, reading as merged.
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tabScroll: { marginTop: 20, flexGrow: 0 },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#334155', fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: '#fff' },
  empty: { color: '#888', marginTop: 20 },
  hidden: { display: 'none' },
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
