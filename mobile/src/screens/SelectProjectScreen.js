import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { COLORS } from '../theme';

// Shown once after login only when a TFO belongs to more than one active
// Project (zero -> skip entirely, one -> auto-selected without asking,
// per spec) - the chosen Project stays active until logout, stored
// alongside the rest of the session.
export default function SelectProjectScreen({ projects, onSelect }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Project</Text>
      <Text style={styles.subtitle}>You're assigned to more than one active project. Choose which one you're working on now.</Text>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: 8 }}
        renderItem={({ item }) => (
          <Pressable style={styles.projectRow} onPress={() => onSelect(item.id)}>
            <Text style={styles.projectTitle}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.primaryDark },
  subtitle: { color: COLORS.textMuted, marginTop: 8, marginBottom: 20, fontSize: 14 },
  projectRow: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 16, marginBottom: 10, backgroundColor: COLORS.primarySoft },
  projectTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark },
});
