import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listTfoDemos } from '../api';
import { COLORS } from '../theme';

const CYCLE_LABELS = {
  demo_1: 'Demo 1', demo_2: 'Demo 2', demo_3: 'Demo 3', demo_4: 'Demo 4',
  adoption_1: 'Adoption 1', adoption_2: 'Adoption 2', adoption_3: 'Adoption 3', adoption_4: 'Adoption 4',
};
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};

// TFO's Demos list - reached from the Home tile, same "list + FAB" shape as
// FarmersListScreen. Tapping a card opens the shared Demo Monitoring page
// (TfoDemoDetailScreen); tapping the FAB starts the farmer-picker step of
// the existing create-demo flow (CreateTfoDemoScreen). The Farmer
// Profile's own "Create Demo" button reaches that same create screen
// directly, skipping this list and its picker entirely (see App.js's
// demoFormOrigin).
export default function TfoDemosListScreen({ token, onBack, onCreateNew, onSelectDemo }) {
  const [demos, setDemos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    listTfoDemos(token)
      .then((data) => setDemos(data.demos))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Demos</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && <ActivityIndicator style={styles.loadingIndicator} />}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={demos || []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          demos !== null && demos.length > 0 ? (
            <Text style={styles.sectionLabel}>All Demos ({demos.length})</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading && demos !== null ? (
            <Text style={styles.empty}>No demos logged yet. Tap + to create one.</Text>
          ) : null
        }
        renderItem={({ item: demo }) => (
          <Pressable style={styles.card} onPress={() => onSelectDemo(demo)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{demo.farmer_name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[demo.status].bg }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[demo.status].text }]}>
                  {STATUS_LABELS[demo.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.cardVillage}>{demo.village_name}</Text>
            <Text style={styles.cardLine}>{CYCLE_LABELS[demo.cycle] || demo.cycle}</Text>
            {!!demo.crop_names && <Text style={styles.cardLine}>{demo.crop_names}</Text>}
            <Text style={styles.cardDate}>{new Date(demo.created_at).toLocaleDateString()}</Text>
          </Pressable>
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
  cardVillage: { color: '#555', fontSize: 13, marginTop: 2 },
  cardDate: { color: '#888', fontSize: 12, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
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
