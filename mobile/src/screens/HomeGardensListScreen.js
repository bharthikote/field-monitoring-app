import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listTfoHomeGardens } from '../api';
import { COLORS } from '../theme';

const CYCLE_LABELS = {
  demo_1: 'Demo 1', homegarden_1: 'Home Garden 1', homegarden_2: 'Home Garden 2', homegarden_3: 'Home Garden 3',
  adoption_1: 'Adoption 1', adoption_2: 'Adoption 2', adoption_3: 'Adoption 3', adoption_4: 'Adoption 4',
};

// Same "list + FAB" shape as TfoDemosListScreen - tapping the FAB starts
// the farmer-picker step of the Home Garden create flow; a Farmer
// Profile's own Create Home Garden button reaches CreateHomeGardenScreen
// directly, skipping this list (see App.js's homeGardenFormOrigin).
export default function HomeGardensListScreen({ token, onBack, onCreateNew }) {
  const [homeGardens, setHomeGardens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listTfoHomeGardens(token)
      .then((data) => setHomeGardens(data.homeGardens))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Home Gardens</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && <ActivityIndicator style={styles.loadingIndicator} />}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={homeGardens || []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          homeGardens !== null && homeGardens.length > 0 ? (
            <Text style={styles.sectionLabel}>All Home Gardens ({homeGardens.length})</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading && homeGardens !== null ? (
            <Text style={styles.empty}>No Home Gardens logged yet. Tap + to create one.</Text>
          ) : null
        }
        renderItem={({ item: homeGarden }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{homeGarden.farmer_name}</Text>
              <Text style={styles.cardVillage}>{homeGarden.village_name}</Text>
            </View>
            <Text style={styles.cardLine}>{CYCLE_LABELS[homeGarden.cycle] || homeGarden.cycle}</Text>
            {!!homeGarden.crop_names && <Text style={styles.cardLine}>{homeGarden.crop_names}</Text>}
            <Text style={styles.cardDate}>{new Date(homeGarden.created_at).toLocaleDateString()}</Text>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={onCreateNew}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  loadingIndicator: { marginTop: 12 },
  list: { flex: 1 },
  listContent: { padding: 24, paddingTop: 16, paddingBottom: 100 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: '#888', marginBottom: 16 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '700', fontSize: 16, flex: 1, marginRight: 8 },
  cardLine: { color: '#555', marginTop: 2 },
  cardVillage: { color: '#555', fontSize: 13, textAlign: 'right' },
  cardDate: { color: '#888', fontSize: 12, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '400' },
});
