import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { COLORS } from '../theme';

// Same minimal line-icon language as the web admin panel's nav icons
// (24x24, stroke-based, no fill), same accent color too.
const ACTIVE_COLOR = COLORS.primary;
const INACTIVE_COLOR = '#9ca3af';

function Icon({ name, color }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'home') {
    return (
      <Svg {...common}>
        <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <Path d="M9 22V12h6v10" />
      </Svg>
    );
  }
  if (name === 'issues') {
    return (
      <Svg {...common}>
        <Circle cx="12" cy="12" r="9" />
        <Line x1="12" y1="8" x2="12" y2="13" />
        <Line x1="12" y1="16" x2="12" y2="16.01" />
      </Svg>
    );
  }
  if (name === 'notifications') {
    return (
      <Svg {...common}>
        <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </Svg>
    );
  }
  if (name === 'messaging') {
    return (
      <Svg {...common}>
        <Path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5z" />
      </Svg>
    );
  }
  return (
    <Svg {...common}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'issues', icon: 'issues', label: 'Issues' },
  { key: 'notifications', icon: 'notifications', label: 'Alerts' },
  { key: 'messaging', icon: 'messaging', label: 'Messages' },
  { key: 'profile', icon: 'profile', label: 'Profile' },
];

export default function BottomTabBar({ active, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Icon name={tab.icon} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e2e2',
    backgroundColor: '#fff', paddingTop: 8, paddingBottom: 20,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, marginTop: 3, fontWeight: '600' },
});
