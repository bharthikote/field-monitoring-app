import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { listIssueTypes, listAssignableUsers, raiseIssue } from '../api';

async function pickPhoto() {
  return new Promise((resolve) => {
    Alert.alert('Add Photo', 'Choose a source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return resolve(null);
          const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
          resolve(result.canceled ? null : result.assets[0]);
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return resolve(null);
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
          resolve(result.canceled ? null : result.assets[0]);
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

function assetToFormFile(asset) {
  const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
  const type = asset.mimeType || 'image/jpeg';
  return { uri: asset.uri, name, type };
}

export default function RaiseIssueScreen({ token, user, plot, onBack, onSubmitted }) {
  const canHold = user.role === 'team_lead';

  const [issueTypes, setIssueTypes] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [issueTypeId, setIssueTypeId] = useState('');
  const [holdForLater, setHoldForLater] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [photo, setPhoto] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [i, a] = await Promise.all([listIssueTypes(token), listAssignableUsers(token)]);
        setIssueTypes(i.items);
        setAssignableUsers(a.users);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingLists(false);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    setError('');
    if (!issueTypeId) return setError('Select the type of issue.');
    if (!holdForLater && !assignedTo) return setError('Select who to assign this to.');

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('demoPlotId', plot.id);
      form.append('issueTypeId', issueTypeId);
      if (!holdForLater) form.append('assignedTo', assignedTo);
      if (photo) form.append('photo', assetToFormFile(photo));

      await raiseIssue(token, form);
      Alert.alert('Issue raised', '', [{ text: 'OK', onPress: onSubmitted }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLists) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Back'}</Text>
      </Pressable>
      <Text style={styles.title}>Raise an Issue</Text>
      <Text style={styles.subLine}>{plot.farmer_name} — {plot.crop_name}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Issue Type</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={issueTypeId} onValueChange={setIssueTypeId}>
            <Picker.Item label="-- select issue type --" value="" />
            {issueTypes.map((i) => <Picker.Item key={i.id} label={i.name} value={i.id} />)}
          </Picker>
        </View>
      </View>

      {canHold && (
        <Pressable style={styles.holdRow} onPress={() => setHoldForLater((v) => !v)}>
          <View style={[styles.checkbox, holdForLater && styles.checkboxChecked]}>
            {holdForLater && <Text style={styles.checkboxTick}>✓</Text>}
          </View>
          <Text style={styles.holdLabel}>Hold — I'll assign this later</Text>
        </Pressable>
      )}

      {!holdForLater && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Assign To</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={assignedTo} onValueChange={setAssignedTo}>
              <Picker.Item label="-- select a person --" value="" />
              {assignableUsers.map((u) => <Picker.Item key={u.id} label={u.name} value={u.id} />)}
            </Picker>
          </View>
          {assignableUsers.length === 0 && (
            <Text style={styles.hint}>No one is assigned to your country yet for this role.</Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Evidence Photo (optional)</Text>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.thumbLarge} />
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Add Photo</Text>
          </Pressable>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Raise Issue</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  back: { color: '#2563eb', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subLine: { color: '#555', marginTop: 4, marginBottom: 8 },
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  hint: { color: '#888', fontSize: 12, marginTop: 6 },
  holdRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  holdLabel: { fontSize: 15 },
  photoBtn: {
    borderWidth: 1, borderColor: '#2563eb', borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', marginTop: 6,
  },
  photoBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  thumbLarge: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#f1f5f9', marginTop: 6 },
  error: { color: '#dc2626', marginTop: 20 },
  submitButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
