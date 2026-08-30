import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { getMyVisitCount, getMyTrainingCount, getMyFieldDayCount, getMyInstitutionVisitCount, getMyAgroDealerVisitCount } from '../api';

// The six daily field activities - order set per feedback (Demo Plot,
// Adoption Plot, Training, Field Day, Institutional Visit, Agro Dealer
// Visit). `solid`/`tint` follow the same paired-color convention already
// used for status pills elsewhere in the app (e.g. DemoPlotDetailScreen's
// STATUS_COLORS).
const ACTIVITIES = [
  { key: 'demoplot', label: 'Demo Plot', icon: 'demoplot', solid: '#16a34a', tint: '#dcfce7' },
  { key: 'adoption', label: 'Adoption Plot', icon: 'adoption', solid: '#d97706', tint: '#fef3c7' },
  { key: 'training', label: 'Training', icon: 'training', solid: '#2563eb', tint: '#dbeafe' },
  { key: 'fieldday', label: 'Field Day', icon: 'fieldday', solid: '#0d9488', tint: '#ccfbf1' },
  { key: 'govt', label: 'Institutional Visit', icon: 'govt', solid: '#7c3aed', tint: '#ede9fe' },
  { key: 'agriinput', label: 'Agro Dealer Visit', icon: 'agriinput', solid: '#db2777', tint: '#fce7f3' },
];

// A more deliberate icon set per activity - a graduation cap, a group of
// people, a plant, a smaller sprout (distinct from the plant, since
// "adopted" implies newly taken up), a bank building, and a storefront -
// replacing the earlier ad-hoc shapes (a location pin stood in for "Demo
// Plot", a heart for "Adoption Plot") that didn't actually depict their
// activity and read as placeholder art rather than a real icon set.
function ActivityIcon({ name, color }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'training') {
    return (
      <Svg {...common}>
        <Path d="M22 10L12 5 2 10l10 5 10-5z" />
        <Path d="M6 12.5V17c0 1.5 2.5 3 6 3s6-1.5 6-3v-4.5" />
      </Svg>
    );
  }
  if (name === 'fieldday') {
    return (
      <Svg {...common}>
        <Circle cx="8.5" cy="8" r="3" />
        <Path d="M2 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
        <Path d="M16 4.6a3 3 0 0 1 0 5.8" />
        <Path d="M17 20v-1a5 5 0 0 0-3-4.6" />
      </Svg>
    );
  }
  if (name === 'demoplot') {
    return (
      <Svg {...common}>
        <Path d="M12 21v-8" />
        <Path d="M12 13C12 9 9 6 5 6c0 4 3 7 7 7z" />
        <Path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7z" />
      </Svg>
    );
  }
  if (name === 'adoption') {
    return (
      <Svg {...common}>
        <Line x1="7" y1="21" x2="17" y2="21" />
        <Path d="M12 21v-6" />
        <Path d="M12 15c0-2.5-2-4.5-4.5-4.5 0 2.5 2 4.5 4.5 4.5z" />
        <Path d="M12 15c0-2.5 2-4.5 4.5-4.5 0 2.5-2 4.5-4.5 4.5z" />
      </Svg>
    );
  }
  if (name === 'govt') {
    return (
      <Svg {...common}>
        <Line x1="3" y1="21" x2="21" y2="21" />
        <Line x1="3" y1="10" x2="21" y2="10" />
        <Path d="M5 6l7-3 7 3" />
        <Line x1="4" y1="10" x2="4" y2="21" />
        <Line x1="20" y1="10" x2="20" y2="21" />
        <Line x1="8" y1="14" x2="8" y2="17" />
        <Line x1="12" y1="14" x2="12" y2="17" />
        <Line x1="16" y1="14" x2="16" y2="17" />
      </Svg>
    );
  }
  return (
    <Svg {...common}>
      <Line x1="3" y1="21" x2="21" y2="21" />
      <Path d="M5 21V10.5" />
      <Path d="M19 21V10.5" />
      <Path d="M3 7l1.5-4h15L21 7" />
      <Path d="M3 7a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <Rect x="9.5" y="14" width="5" height="7" />
    </Svg>
  );
}

function ActivityCard({ label, icon, solid, tint, count, onPress }) {
  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <View style={[styles.iconBadge, { backgroundColor: tint }]}>
        <ActivityIcon name={icon} color={solid} />
        {!!count && (
          <View style={[styles.countBadge, { backgroundColor: solid }]}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.activityCardLabel}>{label}</Text>
    </Pressable>
  );
}

// Every role except TFO records day-to-day field activities here - TFO's
// entire role in this system (Phase 1) is viewing/resolving assigned
// issues (its own bottom tab); the six activities stay in the vendor app
// for TFO specifically.
// Activity keys that already have a real plot-lookup flow behind them,
// mapped to the plot_type they pass through to it. The rest still show
// "Coming Soon" until built out.
const PLOT_ACTIVITY_TYPES = { demoplot: 'demo', adoption: 'adoption' };

export default function HomeScreen({ token, user, onFindDemoPlot, onCreateTraining, onCreateFieldDay, onCreateInstitutionVisit, onCreateAgroDealerVisit }) {
  const showActivities = user.role !== 'tfo';
  const [demoPlotCount, setDemoPlotCount] = useState(null);
  const [adoptionPlotCount, setAdoptionPlotCount] = useState(null);
  const [trainingCount, setTrainingCount] = useState(null);
  const [fieldDayCount, setFieldDayCount] = useState(null);
  const [institutionVisitCount, setInstitutionVisitCount] = useState(null);
  const [agroDealerVisitCount, setAgroDealerVisitCount] = useState(null);

  useEffect(() => {
    if (!showActivities) return;
    getMyVisitCount(token, 'demo').then((data) => setDemoPlotCount(data.count)).catch(() => {});
    getMyVisitCount(token, 'adoption').then((data) => setAdoptionPlotCount(data.count)).catch(() => {});
    getMyTrainingCount(token).then((data) => setTrainingCount(data.count)).catch(() => {});
    getMyFieldDayCount(token).then((data) => setFieldDayCount(data.count)).catch(() => {});
    getMyInstitutionVisitCount(token).then((data) => setInstitutionVisitCount(data.count)).catch(() => {});
    getMyAgroDealerVisitCount(token).then((data) => setAgroDealerVisitCount(data.count)).catch(() => {});
  }, [token, showActivities]);

  const handleActivity = (activity) => {
    const plotType = PLOT_ACTIVITY_TYPES[activity.key];
    if (plotType) {
      onFindDemoPlot(plotType);
      return;
    }
    if (activity.key === 'training') {
      onCreateTraining();
      return;
    }
    if (activity.key === 'fieldday') {
      onCreateFieldDay();
      return;
    }
    if (activity.key === 'govt') {
      onCreateInstitutionVisit();
      return;
    }
    if (activity.key === 'agriinput') {
      onCreateAgroDealerVisit();
      return;
    }
    Alert.alert('Coming Soon', `${activity.label} isn't built yet.`);
  };

  const countFor = (activityKey) => {
    if (activityKey === 'demoplot') return demoPlotCount;
    if (activityKey === 'adoption') return adoptionPlotCount;
    if (activityKey === 'training') return trainingCount;
    if (activityKey === 'fieldday') return fieldDayCount;
    if (activityKey === 'govt') return institutionVisitCount;
    if (activityKey === 'agriinput') return agroDealerVisitCount;
    return null;
  };

  if (!showActivities) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Welcome, {user.name}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}</Text>

      <Text style={styles.sectionLabel}>What are you monitoring today?</Text>
      <View style={styles.grid}>
        {ACTIVITIES.map((activity) => (
          <ActivityCard
            key={activity.key}
            label={activity.label}
            icon={activity.icon}
            solid={activity.solid}
            tint={activity.tint}
            count={countFor(activity.key)}
            onPress={() => handleActivity(activity)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingTop: 56, paddingBottom: 60 },
  centeredContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 32, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  activityCard: {
    width: '47%', minHeight: 104, borderRadius: 14, padding: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e4de', alignItems: 'center',
  },
  iconBadge: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, position: 'relative',
  },
  countBadge: {
    position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  activityCardLabel: { fontSize: 13, fontWeight: '600', color: '#2d2a26', textAlign: 'center' },
});
