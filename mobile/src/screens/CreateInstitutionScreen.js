import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createInstitution, getInstitution } from '../api';
import LocationPicker from '../components/LocationPicker';
import SearchableSelect from '../components/SearchableSelect';
import { COLORS } from '../theme';

const ORG_TYPES = [
  { id: 'kvk', name: 'KVK (Krishi Vigyan Kendra)' },
  { id: 'icar', name: 'ICAR Institute' },
  { id: 'university', name: 'Agriculture University' },
  { id: 'horticulture', name: 'Horticulture Department (SDH)' },
  { id: 'others', name: 'Others' },
];

export default function CreateInstitutionScreen({ token, onBack, onCreated }) {
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState(null);
  const [orgTypeOther, setOrgTypeOther] = useState('');
  const [villageId, setVillageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !orgType || !villageId) {
      setError('Please fill in name, organisation type, and village.');
      return;
    }
    if (orgType === 'others' && !orgTypeOther.trim()) {
      setError('Please specify the organisation type.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const created = await createInstitution(token, {
        name: name.trim(),
        orgType,
        orgTypeOther: orgType === 'others' ? orgTypeOther.trim() : undefined,
        villageId,
      });
      // Re-fetch so onCreated gets the full village breadcrumb (POST
      // /institutions only returns the bare row) - the caller logs the
      // visit right after registering, skipping a village pick since the
      // institution's is now known.
      const full = await getInstitution(token, created.institution.id);
      Alert.alert('Institution registered', '', [{ text: 'OK', onPress: () => onCreated(full.institution) }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Register Institution</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Institution Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <SearchableSelect label="Organisation Type" options={ORG_TYPES} value={orgType} onChange={setOrgType} />

        {orgType === 'others' && (
          <>
            <Text style={styles.label}>Specify Organisation Type</Text>
            <TextInput style={styles.input} value={orgTypeOther} onChangeText={setOrgTypeOther} />
          </>
        )}

        <LocationPicker token={token} onVillageChange={setVillageId} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Institution</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  container: { padding: 24, paddingBottom: 60 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: COLORS.danger, marginTop: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
