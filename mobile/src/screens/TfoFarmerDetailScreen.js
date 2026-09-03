import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getFarmerActivities, deactivateFarmer } from '../api';
import { COLORS } from '../theme';

const FARMER_TYPE_LABELS = {
  key_farmer: 'Key Farmer', core_farmer: 'Core Farmer', farmer: 'Farmer', community_trainer_farmer: 'Community Trainer Farmer',
};
const GENDER_ABBR = { male: 'M', female: 'F', others: 'O' };
const EDUCATION_LEVEL_LABELS = { primary: 'Primary', secondary: 'Secondary', higher: 'Higher', adult: 'Adult', no_school: 'No School' };
const LITERACY_LABELS = { yes: 'Yes', no: 'No' };
const PHONE_TYPE_LABELS = { smartphone: 'Smart Phone', cellphone: 'Cell Phone', no_phone: 'No Phone' };
const SOCIAL_MEDIA_LABELS = { facebook: 'Facebook', instagram: 'Instagram', snapchat: 'Snapchat', telegram: 'Telegram', tiktok: 'TikTok', twitter: 'Twitter' };

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};
const TRAINING_TYPE_LABELS = { classroom: 'Classroom / Theory', field_based: 'Field-Based / Practical', mixed: 'Mixed (Both)' };
const FIELDDAY_TYPE_LABELS = { practical: 'Practical (Hands-On / Field)', theory: 'Theory (Classroom / Discussion)', both: 'Both Practical & Theory' };
// Superset of both Demo's and Home Garden's cycle enums - each activity
// only ever carries values from its own set, so sharing one label map is
// safe (demo_2..4 never appear on a homegarden row and vice versa).
const CYCLE_LABELS = {
  demo_1: 'Demo 1', demo_2: 'Demo 2', demo_3: 'Demo 3', demo_4: 'Demo 4',
  homegarden_1: 'Home Garden 1', homegarden_2: 'Home Garden 2', homegarden_3: 'Home Garden 3',
  adoption_1: 'Adoption 1', adoption_2: 'Adoption 2', adoption_3: 'Adoption 3', adoption_4: 'Adoption 4',
};

// TFO's own activity set (per HomeScreen's TFO_ACTIVITIES): Demo Plot,
// Home Garden, Training, Field Day - no Adoption Plot (not part of the TFO
// activity set) and no Market Survey (that's about a shop, not tied to one
// farmer).
const TABS = [
  { key: 'demo', label: 'Demo' },
  { key: 'homegarden', label: 'Home Garden' },
  { key: 'training', label: 'Training' },
  { key: 'fieldday', label: 'Field Day' },
];

function PersonPlaceholderIcon() {
  return (
    <Svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}

// Matches the vendor app's own "Symbol Definition" legend: Key Farmer gets
// a key, Core Farmer a sprout, Community Trainer Farmer a target-like
// circle, and plain Farmer gets no icon at all (see FarmerTypeIcon below).
function KeyFarmerIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primaryDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="8" cy="16" r="4" />
      <Path d="M10.5 13.5L20 4" />
      <Path d="M17 7l2 2" />
      <Path d="M14 10l2 2" />
    </Svg>
  );
}

function CoreFarmerIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primaryDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21v-9" />
      <Path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" />
      <Path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" />
      <Path d="M12 12c-1-3 0-6 2-8-1 3-1 6-2 8z" />
    </Svg>
  );
}

function CftFarmerIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primaryDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="4.5" />
      <Circle cx="12" cy="12" r="1" fill={COLORS.primaryDark} />
    </Svg>
  );
}

function FarmerTypeIcon({ type }) {
  if (type === 'key_farmer') return <KeyFarmerIcon />;
  if (type === 'core_farmer') return <CoreFarmerIcon />;
  if (type === 'community_trainer_farmer') return <CftFarmerIcon />;
  return null;
}

function DetailField({ label, value }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

function ActivityCard({ activity }) {
  if (activity.activityType === 'training') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Training — {TRAINING_TYPE_LABELS[activity.training_type]}</Text>
        <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
        {activity.remarks ? <Text style={styles.cardLine}>{activity.remarks}</Text> : null}
        {activity.photo_url ? <Image source={{ uri: activity.photo_url }} style={styles.thumb} /> : null}
      </View>
    );
  }
  if (activity.activityType === 'fieldday') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Field Day — {FIELDDAY_TYPE_LABELS[activity.fieldday_type]}</Text>
        <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
        <Text style={styles.cardLine}>Expected harvest: {activity.expected_harvest_date}</Text>
        {activity.remarks ? <Text style={styles.cardLine}>{activity.remarks}</Text> : null}
        {activity.photo_url ? <Image source={{ uri: activity.photo_url }} style={styles.thumb} /> : null}
      </View>
    );
  }
  if (activity.activityType === 'homegarden') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{activity.crop_name} — {CYCLE_LABELS[activity.cycle] || activity.cycle}</Text>
        <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
        <Text style={styles.cardLine}>{activity.variety_name} · {activity.no_of_seedlings} seedlings</Text>
        <Text style={styles.cardLine}>Sown {activity.sowing_date} → Transplanted {activity.transplant_date} → Harvested {activity.harvest_date}</Text>
        {(activity.container_number || activity.plant_number) && (
          <Text style={styles.cardLine}>
            {[activity.container_number && `Container ${activity.container_number}`, activity.plant_number && `Plant ${activity.plant_number}`].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    );
  }
  // A TFO demo's crop entries share activityType 'demo' with demo_plots
  // (so they land in the same tab), but carry no demo_status - that's how
  // the two are told apart here, rather than a separate activityType the
  // tab filter would also need to know about.
  if (activity.demo_status === undefined) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{activity.crop_name} — {CYCLE_LABELS[activity.cycle] || activity.cycle}</Text>
        <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
        <Text style={styles.cardLine}>{activity.variety_name} · {activity.season_name}</Text>
        <Text style={styles.cardLine}>Sown {activity.sowing_date} → Transplanted {activity.transplant_date} → Est. Harvest {activity.est_harvest_date}</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{activity.crop_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[activity.demo_status].bg }]}>
          <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[activity.demo_status].text }]}>
            {STATUS_LABELS[activity.demo_status]}
          </Text>
        </View>
      </View>
      <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
      <Text style={styles.cardLine}>{activity.variety_name}</Text>
    </View>
  );
}

export default function TfoFarmerDetailScreen({ token, farmer, onBack, onEdit, onDeactivated, onCreateDemo, onCreateHomeGarden }) {
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('demo');
  const [expanded, setExpanded] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFarmerActivities(token, farmer.id);
      setActivities(data.activities);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [farmer.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Only demo_plots with plot_type 'demo' - Adoption Plot isn't part of the
  // TFO activity set, and Market Survey doesn't have a backend entity yet.
  const filtered = (activities || []).filter((a) => a.activityType === activeTab);
  const activeTabLabel = TABS.find((t) => t.key === activeTab).label;

  const comingSoon = (label) => Alert.alert('Coming Soon', `${label} isn't built yet.`);

  const handleCreateForActiveTab = () => {
    if (activeTab === 'demo') return onCreateDemo();
    if (activeTab === 'homegarden') return onCreateHomeGarden();
    return comingSoon(`Create ${activeTabLabel}`);
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Farmer',
      `This will remove ${farmer.name} from the farmers list. Their existing activity history is kept, but no new activities can be logged for them.\n\nAre you sure you want to continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setDeactivating(true);
            try {
              await deactivateFarmer(token, farmer.id);
              onDeactivated();
            } catch (err) {
              Alert.alert('Something went wrong', err.message);
              setDeactivating(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>

        <View style={styles.card2}>
          <View style={styles.profileRow}>
            {farmer.photo_url ? (
              <Image source={{ uri: farmer.photo_url }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <PersonPlaceholderIcon />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{farmer.name}</Text>
              {farmer.farmer_type && (
                <View style={styles.typeRow}>
                  <FarmerTypeIcon type={farmer.farmer_type} />
                  <Text style={styles.typeText}>{FARMER_TYPE_LABELS[farmer.farmer_type]}</Text>
                </View>
              )}
              <Text style={styles.summaryLine}>
                {[GENDER_ABBR[farmer.gender], farmer.age].filter(Boolean).join(', ')}
                {farmer.phone ? ` | ${farmer.phone}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            <Pressable style={styles.pill} onPress={onEdit}>
              <Text style={styles.pillText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.pillDanger} onPress={handleDeactivate} disabled={deactivating}>
              {deactivating ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Text style={styles.pillDangerText}>Deactivate</Text>
              )}
            </Pressable>
            <Pressable style={styles.pill} onPress={() => setExpanded((v) => !v)}>
              <Text style={styles.pillText}>{expanded ? 'Show less' : 'Show more'}</Text>
            </Pressable>
          </View>
        </View>

        {expanded && (
          <View style={styles.detailPanel}>
            <View style={styles.detailRow}>
              <DetailField label="Location" value={farmer.village_name} />
              <DetailField label="Educational Lvl" value={EDUCATION_LEVEL_LABELS[farmer.education_level]} />
              <DetailField label="Literacy" value={LITERACY_LABELS[farmer.literacy]} />
            </View>
            <View style={styles.detailRow}>
              <DetailField label="Phone Type" value={PHONE_TYPE_LABELS[farmer.phone_type]} />
              <DetailField label="Social Media" value={farmer.social_media?.map((p) => SOCIAL_MEDIA_LABELS[p]).join(', ')} />
              <DetailField label="Email" value={farmer.email} />
            </View>
            <View style={styles.detailRow}>
              <DetailField label="Address" value={farmer.address} />
            </View>
          </View>
        )}

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.createButton} onPress={handleCreateForActiveTab}>
          <Text style={styles.createButtonText}>Create {activeTabLabel}</Text>
        </Pressable>

        {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filtered.length === 0 && (
          <Text style={styles.empty}>No {activeTabLabel} activities logged for this farmer yet.</Text>
        )}
        {filtered.map((a) => (
          <ActivityCard key={`${a.activityType}-${a.id}`} activity={a} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 24, paddingBottom: 60 },
  back: { color: COLORS.primary, marginBottom: 16 },
  card2: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 14, padding: 16 },
  profileRow: { flexDirection: 'row', gap: 14 },
  photo: { width: 72, height: 72, borderRadius: 12 },
  photoPlaceholder: {
    width: 72, height: 72, borderRadius: 12, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  typeText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  summaryLine: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  pill: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  pillDanger: { backgroundColor: COLORS.dangerSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillDangerText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  detailPanel: { backgroundColor: '#f7f6f3', borderRadius: 12, padding: 16, marginTop: 12, gap: 14 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailField: { flex: 1 },
  detailLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#2d2a26', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 6, marginTop: 20 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#334155', fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: '#fff' },
  createButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', marginTop: 20 },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: COLORS.danger, marginTop: 12 },
  empty: { color: '#888', marginTop: 20 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginTop: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
  cardDate: { color: '#888', fontSize: 12, marginTop: 2 },
  cardLine: { color: '#555', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  thumb: { width: '100%', height: 140, borderRadius: 8, marginTop: 8, backgroundColor: '#f1f5f9' },
});
