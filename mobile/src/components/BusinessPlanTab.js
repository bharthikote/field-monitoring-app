import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ExpectedCostTab from './ExpectedCostTab';
import ExpectedReturnTab from './ExpectedReturnTab';
import { COLORS } from '../theme';

const ORANGE = '#f2994a';

// Owns the Expected Cost / Expected Return pill toggle shared by both tabs
// (previously lived inside ExpectedCostTab itself, back when Return was
// just a placeholder message - split out now that both are real).
//
// Only mounted by the parent while Business Plan is the active top-level
// tab, and only the currently-selected pill's tab is mounted here - the
// demo summary card's KPIs now come from Actual Cost/Return instead (the
// planning layer no longer needs to fetch in the background for that).
export default function BusinessPlanTab({ token, demoId }) {
  const [subTab, setSubTab] = useState('cost');

  return (
    <View>
      <View style={styles.subTabRow}>
        <Pressable style={[styles.subTab, subTab === 'cost' ? styles.subTabActive : styles.subTabInactive]} onPress={() => setSubTab('cost')}>
          <Text style={subTab === 'cost' ? styles.subTabActiveText : styles.subTabInactiveText}>Expected Cost</Text>
        </Pressable>
        <Pressable style={[styles.subTab, subTab === 'return' ? styles.subTabActive : styles.subTabInactive]} onPress={() => setSubTab('return')}>
          <Text style={subTab === 'return' ? styles.subTabActiveText : styles.subTabInactiveText}>Expected Return</Text>
        </Pressable>
      </View>

      {subTab === 'cost' ? <ExpectedCostTab token={token} demoId={demoId} /> : <ExpectedReturnTab token={token} demoId={demoId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  subTabRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  subTabActive: { backgroundColor: ORANGE },
  subTabActiveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subTabInactive: { backgroundColor: COLORS.primarySoft },
  subTabInactiveText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
});
