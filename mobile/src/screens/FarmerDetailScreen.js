import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { getFarmerActivities } from '../api';
import { COLORS } from '../theme';

const PLOT_TYPE_LABELS = { demo: 'Demo Plot', adoption: 'Adoption Plot' };
const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', terminated: 'Terminated' };
const STATUS_COLORS = {
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
};
const TRAINING_TYPE_LABELS = { classroom: 'Classroom / Theory', field_based: 'Field-Based / Practical', mixed: 'Mixed (Both)' };

function ActivityCard({ activity, onSelectPlot }) {
  const isTraining = activity.activityType === 'training';
  if (isTraining) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Training — {TRAINING_TYPE_LABELS[activity.training_type]}</Text>
        </View>
        <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
        {activity.remarks ? <Text style={styles.cardLine}>{activity.remarks}</Text> : null}
        {activity.photo_url ? <Image source={{ uri: activity.photo_url }} style={styles.thumb} /> : null}
      </View>
    );
  }
  return (
    <Pressable style={styles.card} onPress={() => onSelectPlot(activity)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{PLOT_TYPE_LABELS[activity.plot_type]} — {activity.crop_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[activity.demo_status].bg }]}>
          <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[activity.demo_status].text }]}>
            {STATUS_LABELS[activity.demo_status]}
          </Text>
        </View>
      </View>
      <Text style={styles.cardDate}>{new Date(activity.created_at).toLocaleDateString()}</Text>
      <Text style={styles.cardLine}>{activity.variety_name}</Text>
    </Pressable>
  );
}

export default function FarmerDetailScreen({ token, farmer, onBack, onSelectPlot }) {
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFarmerActivities(token, farmer.id);
      setActivities(data.activities);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [farmer.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <View style={styles.infoBox}>
          <Text style={styles.title}>{farmer.name}</Text>
          <Text style={styles.subLine}>{farmer.phone}</Text>
          <Text style={styles.villageLine}>{farmer.village_name}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && activities && activities.length === 0 && (
          <Text style={styles.empty}>No activities logged for this farmer yet.</Text>
        )}
        {activities && activities.map((a) => (
          <ActivityCard key={`${a.activityType}-${a.id}`} activity={a} onSelectPlot={onSelectPlot} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 24, paddingBottom: 10 },
  back: { color: COLORS.primary, marginBottom: 16 },
  infoBox: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14 },
  title: { fontSize: 20, fontWeight: '700' },
  subLine: { color: '#555', marginTop: 4, fontSize: 13 },
  villageLine: { color: '#555', marginTop: 2, fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 8, paddingBottom: 60 },
  error: { color: COLORS.danger, marginTop: 12 },
  empty: { color: '#888' },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
  cardDate: { color: '#888', fontSize: 12, marginTop: 2 },
  cardLine: { color: '#555', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  thumb: { width: '100%', height: 140, borderRadius: 8, marginTop: 8, backgroundColor: '#f1f5f9' },
});
