import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import VillageSearchSelect from './VillageSearchSelect';
import { COLORS } from '../theme';

// Search-and-pick a village directly by name instead of stepping through
// the Country > State > District > Block cascade first - every role,
// including Super Admin, since this is about picking a village for a demo
// plot, not managing the hierarchy itself.
//
// `lockedVillage` (optional, full village object with id/name/block_name/
// district_name/state_name/country_name) overrides and disables selection -
// a farmer lives in one village, so once we know an existing farmer's
// village (from their earlier plots), every new plot for them reuses it
// rather than letting a different village be picked by mistake.
export default function LocationPicker({ token, onVillageChange, lockedVillage }) {
  const [village, setVillage] = useState(null);
  const effectiveVillage = lockedVillage || village;

  useEffect(() => {
    onVillageChange(effectiveVillage ? effectiveVillage.id : null);
  }, [effectiveVillage]);

  return (
    <View>
      <VillageSearchSelect
        token={token}
        value={effectiveVillage?.id}
        selectedLabel={effectiveVillage?.name}
        onSelect={setVillage}
        disabled={!!lockedVillage}
      />
      {effectiveVillage ? (
        <Text style={styles.breadcrumb}>
          {effectiveVillage.block_name} → {effectiveVillage.district_name} → {effectiveVillage.state_name} → {effectiveVillage.country_name}
        </Text>
      ) : null}
      {lockedVillage ? (
        <Text style={styles.lockedNote}>This farmer is already registered in this village.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  lockedNote: { fontSize: 12, color: COLORS.primaryDark, marginTop: 4 },
});
