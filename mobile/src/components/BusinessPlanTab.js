import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ExpectedCostTab from './ExpectedCostTab';
import ExpectedReturnTab from './ExpectedReturnTab';
import { COLORS } from '../theme';

const ORANGE = '#f2994a';

// Owns the Expected Cost / Expected Return pill toggle shared by both tabs
// (previously lived inside ExpectedCostTab itself, back when Return was
// just a placeholder message - split out now that both are real).
//
// Both tabs are always mounted and fetching, regardless of which pill is
// selected or even whether Business Plan is the currently visible top-level
// tab (controlled by the `visible` prop, hiding via style rather than
// unmounting) - the demo summary card's Cost/Return/Production KPIs need
// live totals from both the moment the screen loads, not just once the
// user happens to tap into Business Plan.
export default function BusinessPlanTab({ token, demoId, visible = true, onTotalsChange }) {
  const [subTab, setSubTab] = useState('cost');
  const [costTotal, setCostTotal] = useState(0);
  const [returnTotal, setReturnTotal] = useState(0);
  const [currency, setCurrency] = useState(null);
  const [production, setProduction] = useState('0');

  // Only fires when one of these primitives actually changes (not on
  // every re-render of this component), so bubbling up to the parent
  // can't create a render loop.
  useEffect(() => {
    if (onTotalsChange) onTotalsChange(costTotal, returnTotal, currency, production);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costTotal, returnTotal, currency, production]);

  return (
    <View style={visible ? undefined : styles.hidden}>
      <View style={styles.subTabRow}>
        <Pressable style={[styles.subTab, subTab === 'cost' ? styles.subTabActive : styles.subTabInactive]} onPress={() => setSubTab('cost')}>
          <Text style={subTab === 'cost' ? styles.subTabActiveText : styles.subTabInactiveText}>Expected Cost</Text>
        </Pressable>
        <Pressable style={[styles.subTab, subTab === 'return' ? styles.subTabActive : styles.subTabInactive]} onPress={() => setSubTab('return')}>
          <Text style={subTab === 'return' ? styles.subTabActiveText : styles.subTabInactiveText}>Expected Return</Text>
        </Pressable>
      </View>

      <View style={subTab === 'cost' ? undefined : styles.hidden}>
        {/* Cost also reports a currency, but Return's is used for the KPI
            card below - both come from the same demo's country, and
            Return's response always carries it (derived from the country
            row directly) even if this country has no configured Return
            items yet, so it's the safer single source. */}
        <ExpectedCostTab token={token} demoId={demoId} onTotalChange={setCostTotal} />
      </View>
      <View style={subTab === 'return' ? undefined : styles.hidden}>
        <ExpectedReturnTab
          token={token}
          demoId={demoId}
          onTotalChange={(total, cur, prod) => {
            setReturnTotal(total);
            setCurrency(cur);
            setProduction(prod);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  subTabRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  subTabActive: { backgroundColor: ORANGE },
  subTabActiveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subTabInactive: { backgroundColor: COLORS.primarySoft },
  subTabInactiveText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
});
