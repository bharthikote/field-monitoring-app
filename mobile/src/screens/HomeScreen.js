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
  { key: 'data_collection', label: 'Data Collection', icon: 'clipboard', solid: '#4f8b5b', tint: '#e8f3ea' },
];

// TFO's own activity set (confirmed scope: Demo Plot, Home Garden,
// Training, Field Day, Market Survey - no Institutional/Agro Dealer Visit).
// Attendance isn't its own tile - it's folded into Training/Field Day
// instead, to be designed later. Layout only for now - every tile is a
// placeholder until each is built out one by one, same as how the six
// activities above started. Distinct 'tfo_' keys throughout, deliberately
// not reusing the higher-role Demo Plot/Training/Field Day flows yet -
// TFOs are expected to collect more farmer detail than those forms do
// today, to be worked out in a later pass.
const TFO_ACTIVITIES = [
  { key: 'tfo_demoplot', label: 'Demo Plot', icon: 'demoplot', solid: '#16a34a', tint: '#dcfce7' },
  { key: 'tfo_homegarden', label: 'Home Garden', icon: 'homegarden', solid: '#c2410c', tint: '#ffedd5' },
  { key: 'tfo_training', label: 'Training', icon: 'training', solid: '#2563eb', tint: '#dbeafe' },
  { key: 'tfo_fieldday', label: 'Field Day', icon: 'fieldday', solid: '#0d9488', tint: '#ccfbf1' },
  { key: 'tfo_marketsurvey', label: 'Market Survey', icon: 'marketsurvey', solid: '#0891b2', tint: '#cffafe' },
  { key: 'data_collection', label: 'Data Collection', icon: 'clipboard', solid: '#4f8b5b', tint: '#e8f3ea' },
];

// Data Enumerator: one rung below TFO - no activity logging of their own,
// just farmer profiles (the existing Farmers tab, read-only) plus whatever
// custom forms Super Admin has assigned them under Data Collection. Every
// other role gets Data Collection folded into their own activity grid
// above instead of a dedicated screen - this one exists because Data
// Enumerator has nothing else to show alongside it.
const DATA_ENUMERATOR_ACTIVITIES = [
  { key: 'data_collection', label: 'Data Collection', icon: 'clipboard', solid: '#4f8b5b', tint: '#e8f3ea' },
];

// A more deliberate icon set per activity - a graduation cap, a group of
// people, a plant, a smaller sprout (distinct from the plant, since
// "adopted" implies newly taken up), a bank building, and a storefront -
// replacing the earlier ad-hoc shapes (a location pin stood in for "Demo
// Plot", a heart for "Adoption Plot") that didn't actually depict their
// activity and read as placeholder art rather than a real icon set.
function ActivityIcon({ name, color }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
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
  if (name === 'agriinput') {
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
  if (name === 'homegarden') {
    return (
      <Svg {...common}>
        <Path d="M3 11L12 4l9 7" />
        <Path d="M5 10v10h14V10" />
        <Path d="M12 20v-3" />
        <Path d="M12 17c-1.3 0-2-1-2-2s.7-2 2-2 2 1 2 2-.7 2-2 2z" />
      </Svg>
    );
  }
  if (name === 'attendance') {
    return (
      <Svg {...common}>
        <Rect x="5" y="4" width="14" height="17" rx="2" />
        <Path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
        <Path d="M9 12l2 2 4-4" />
        <Line x1="8" y1="17" x2="16" y2="17" />
      </Svg>
    );
  }
  if (name === 'clipboard') {
    return (
      <Svg {...common}>
        <Rect x="5" y="4" width="14" height="17" rx="2" />
        <Path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
        <Line x1="8" y1="11" x2="16" y2="11" />
        <Line x1="8" y1="15" x2="16" y2="15" />
      </Svg>
    );
  }
  if (name === 'marketsurvey') {
    return (
      <Svg {...common}>
        <Path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 9z" />
        <Path d="M8 9V7a4 4 0 0 1 8 0v2" />
        <Line x1="9" y1="13" x2="9" y2="17" />
        <Line x1="15" y1="13" x2="15" y2="17" />
      </Svg>
    );
  }
  return null;
}

function ActivityCard({ label, icon, solid, tint, count, onPress }) {
  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <View style={[styles.iconBadge, { backgroundColor: tint }]}>
        <ActivityIcon name={icon} color={solid} />
      </View>
      {!!count && <Text style={[styles.countText, { color: solid }]}>{count} logged</Text>}
      <Text style={styles.activityCardLabel}>{label}</Text>
    </Pressable>
  );
}

// TFOs get their own activity set (TFO_ACTIVITIES) instead of this one -
// higher roles monitor TFO work rather than logging these six themselves.
// Activity keys that already have a real plot-lookup flow behind them,
// mapped to the plot_type they pass through to it. The rest still show
// "Coming Soon" until built out.
const PLOT_ACTIVITY_TYPES = { demoplot: 'demo', adoption: 'adoption' };

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ token, user, onFindDemoPlot, onCreateTraining, onCreateFieldDay, onCreateInstitutionVisit, onCreateAgroDealerVisit, onOpenDataCollection, onCreateTfoDemo }) {
  const isTfo = user.role === 'tfo';
  const isDataEnumerator = user.role === 'data_enumerator';
  const [demoPlotCount, setDemoPlotCount] = useState(null);
  const [adoptionPlotCount, setAdoptionPlotCount] = useState(null);
  const [trainingCount, setTrainingCount] = useState(null);
  const [fieldDayCount, setFieldDayCount] = useState(null);
  const [institutionVisitCount, setInstitutionVisitCount] = useState(null);
  const [agroDealerVisitCount, setAgroDealerVisitCount] = useState(null);

  useEffect(() => {
    if (isTfo || isDataEnumerator) return;
    getMyVisitCount(token, 'demo').then((data) => setDemoPlotCount(data.count)).catch(() => {});
    getMyVisitCount(token, 'adoption').then((data) => setAdoptionPlotCount(data.count)).catch(() => {});
    getMyTrainingCount(token).then((data) => setTrainingCount(data.count)).catch(() => {});
    getMyFieldDayCount(token).then((data) => setFieldDayCount(data.count)).catch(() => {});
    getMyInstitutionVisitCount(token).then((data) => setInstitutionVisitCount(data.count)).catch(() => {});
    getMyAgroDealerVisitCount(token).then((data) => setAgroDealerVisitCount(data.count)).catch(() => {});
  }, [token, isTfo, isDataEnumerator]);

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
    if (activity.key === 'data_collection') {
      onOpenDataCollection();
      return;
    }
    Alert.alert('Coming Soon', `${activity.label} isn't built yet.`);
  };

  const handleTfoActivity = (activity) => {
    if (activity.key === 'tfo_demoplot') {
      onCreateTfoDemo();
      return;
    }
    if (activity.key === 'data_collection') {
      onOpenDataCollection();
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

  // Data Enumerator: no activity logging at all, just the one Data
  // Collection tile - farmer profiles stay on the existing Farmers tab
  // (read-only for this role, gated at the App.js level).
  if (isDataEnumerator) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.title}>{user.name}</Text>

        <Text style={styles.sectionLabel}>What are you working on today?</Text>
        <View style={styles.grid}>
          {DATA_ENUMERATOR_ACTIVITIES.map((activity) => (
            <ActivityCard
              key={activity.key}
              label={activity.label}
              icon={activity.icon}
              solid={activity.solid}
              tint={activity.tint}
              count={null}
              onPress={onOpenDataCollection}
            />
          ))}
        </View>
      </ScrollView>
    );
  }

  // Layout only, per explicit scope - every TFO tile is a placeholder
  // ("Coming Soon") until each activity is built out one by one, same as
  // the six activities above were. Data Collection is the exception - it's
  // real, shared by every role.
  if (isTfo) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.title}>{user.name}</Text>

        <Text style={styles.sectionLabel}>What are you monitoring today?</Text>
        <View style={styles.grid}>
          {TFO_ACTIVITIES.map((activity) => (
            <ActivityCard
              key={activity.key}
              label={activity.label}
              icon={activity.icon}
              solid={activity.solid}
              tint={activity.tint}
              count={null}
              onPress={() => handleTfoActivity(activity)}
            />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.title}>{user.name}</Text>

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
  greeting: { fontSize: 13, color: '#837f77' },
  title: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 32, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  activityCard: {
    width: '47%', minHeight: 104, borderRadius: 14, padding: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e4de', alignItems: 'center',
  },
  iconBadge: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  countText: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  activityCardLabel: { fontSize: 13, fontWeight: '600', color: '#2d2a26', textAlign: 'center' },
});
