import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import VillageSearchSelect from './VillageSearchSelect';
import { COLORS } from '../theme';

// Search-and-pick a village directly by name instead of stepping through
// the Country > State > District > Block cascade first - every role,
// including Super Admin, since this is about picking a village for a demo
// plot, not managing the hierarchy itself.
export default function LocationPicker({ token, onVillageChange }) {
  const [village, setVillage] = useState(null);

  useEffect(() => {
    onVillageChange(village ? village.id : null);
  }, [village]);

  return (
    <View>
      <VillageSearchSelect
        token={token}
        value={village?.id}
        selectedLabel={village?.name}
        onSelect={setVillage}
      />
      {village ? (
        <Text style={styles.breadcrumb}>
          {village.block_name} → {village.district_name} → {village.state_name} → {village.country_name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
});
