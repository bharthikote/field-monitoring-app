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

function ActivityIcon({ name, color }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'training') {
    return (
      <Svg {...common}>
        <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </Svg>
    );
  }
  if (name === 'fieldday') {
    return (
      <Svg {...common}>
        <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <Line x1="16" y1="2" x2="16" y2="6" />
        <Line x1="8" y1="2" x2="8" y2="6" />
        <Line x1="3" y1="10" x2="21" y2="10" />
      </Svg>
    );
  }
  if (name === 'demoplot') {
    return (
      <Svg {...common}>
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <Circle cx="12" cy="10" r="3" />
      </Svg>
    );
  }
  if (name === 'adoption') {
    return (
      <Svg {...common}>
        <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </Svg>
    );
  }
  if (name === 'govt') {
    return (
      <Svg {...common}>
        <Rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </Svg>
    );
  }
  return (
    <Svg {...common}>
      <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <Line x1="3" y1="6" x2="21" y2="6" />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </Svg>
  );
}

function ActivityCard({ label, icon, solid, tint, count, onPress }) {
  return (
    <Pressable style={[styles.activityCard, { backgroundColor: tint }]} onPress={onPress}>
      <Text style={[styles.activityCardLabel, { color: solid }]}>{label}</Text>
      <View style={styles.activityCardFooter}>
        <ActivityIcon name={icon} color={solid} />
        {count !== null && count !== undefined && (
          <Text style={[styles.activityCardCount, { color: solid }]}>{count}</Text>
        )}
      </View>
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
    width: '47%', minHeight: 90, borderRadius: 10, padding: 14, justifyContent: 'space-between',
  },
  activityCardLabel: { fontWeight: '700', fontSize: 14, textAlign: 'right' },
  activityCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  activityCardCount: { fontWeight: '700', fontSize: 16 },
});
