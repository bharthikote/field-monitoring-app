import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getMyDataCollectionForms } from '../api';
import { COLORS } from '../theme';

export default function DataCollectionFormsListScreen({ token, onBack, onSelectForm }) {
  const [forms, setForms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyDataCollectionForms(token)
      .then((data) => setForms(data.forms))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Data Collection</Text>
        <Text style={styles.subtitle}>Pick a form to fill out for a farmer.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && <ActivityIndicator style={styles.loadingIndicator} />}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={forms || []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loading && forms !== null ? (
            <Text style={styles.empty}>No forms have been assigned to you yet.</Text>
          ) : null
        }
        renderItem={({ item: form }) => (
          <Pressable style={styles.card} onPress={() => onSelectForm(form)}>
            <Text style={styles.cardTitle}>{form.title}</Text>
            {!!form.description && <Text style={styles.cardDescription}>{form.description}</Text>}
            <Text style={styles.cardMeta}>{form.field_count} field{form.field_count === 1 ? '' : 's'}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13 },
  error: { color: COLORS.danger, marginTop: 12, marginHorizontal: 24 },
  loadingIndicator: { marginTop: 12 },
  list: { flex: 1 },
  listContent: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  empty: { color: COLORS.textMuted, marginTop: 8 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  cardDescription: { color: COLORS.textMuted, marginTop: 4, fontSize: 13 },
  cardMeta: { color: COLORS.primaryDark, marginTop: 8, fontSize: 12, fontWeight: '600' },
});
