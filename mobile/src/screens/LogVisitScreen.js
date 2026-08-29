import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { listIssueTypes, listGoodThings, listDiseases, listPests, createVisit } from '../api';

const DISEASE_TRIGGER = 'Demo Plot Infested by Disease';
const PEST_TRIGGER = 'Demo Plot Infested by Pests';
const OTHER_VALUE = '__other__';

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

// One row per item (issue or good-thing): a checkbox, and once checked,
// an optional evidence photo - matches the current Kobo form exactly.
function ChecklistWithPhotos({ title, items, selectedIds, onToggle, photos, onPickPhoto }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        return (
          <View key={item.id} style={styles.checkRow}>
            <Pressable style={styles.checkRowMain} onPress={() => onToggle(item.id)}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{item.name}</Text>
            </Pressable>
            {checked && (
              <View style={styles.photoRow}>
                {photos[item.id] ? (
                  <Image source={{ uri: photos[item.id].uri }} style={styles.thumb} />
                ) : (
                  <Pressable style={styles.photoBtn} onPress={() => onPickPhoto(item.id)}>
                    <Text style={styles.photoBtnText}>+ Evidence Photo (optional)</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function LogVisitScreen({ token, plot, onBack, onSubmitted }) {
  const [issueTypes, setIssueTypes] = useState([]);
  const [goodThings, setGoodThings] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [pests, setPests] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [selectedIssues, setSelectedIssues] = useState([]);
  const [issuePhotos, setIssuePhotos] = useState({});
  const [selectedGoodThings, setSelectedGoodThings] = useState([]);
  const [goodThingPhotos, setGoodThingPhotos] = useState({});

  const [diseaseChoice, setDiseaseChoice] = useState('');
  const [diseaseOther, setDiseaseOther] = useState('');
  const [diseasePhoto, setDiseasePhoto] = useState(null);
  const [pestChoice, setPestChoice] = useState('');
  const [pestOther, setPestOther] = useState('');
  const [pestPhoto, setPestPhoto] = useState(null);

  const [actionPlan, setActionPlan] = useState('');
  const [comments, setComments] = useState('');
  const [overallPhoto, setOverallPhoto] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [i, g, d, p] = await Promise.all([
          listIssueTypes(token),
          listGoodThings(token),
          listDiseases(token),
          listPests(token),
        ]);
        setIssueTypes(i.items);
        setGoodThings(g.items);
        setDiseases(d.items);
        setPests(p.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingLists(false);
      }
    })();
  }, []);

  const diseaseIssueId = issueTypes.find((i) => i.name === DISEASE_TRIGGER)?.id;
  const pestIssueId = issueTypes.find((i) => i.name === PEST_TRIGGER)?.id;
  const showDiseaseSection = diseaseIssueId && selectedIssues.includes(diseaseIssueId);
  const showPestSection = pestIssueId && selectedIssues.includes(pestIssueId);

  const toggleIssue = (id) => {
    setSelectedIssues((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleGoodThing = (id) => {
    setSelectedGoodThings((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pickIssuePhoto = async (id) => {
    const asset = await pickPhoto();
    if (asset) setIssuePhotos((prev) => ({ ...prev, [id]: asset }));
  };
  const pickGoodThingPhoto = async (id) => {
    const asset = await pickPhoto();
    if (asset) setGoodThingPhotos((prev) => ({ ...prev, [id]: asset }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!actionPlan.trim() || !comments.trim()) {
      setError('Action Plan and Remarks are both required.');
      return;
    }
    if (!overallPhoto) {
      setError('A photo of the visit is required.');
      return;
    }
    if (showDiseaseSection) {
      if (!diseaseChoice) return setError('Select the disease observed.');
      if (diseaseChoice === OTHER_VALUE && !diseaseOther.trim()) return setError('Specify the disease name.');
      if (!diseasePhoto) return setError('A disease photo is required.');
    }
    if (showPestSection) {
      if (!pestChoice) return setError('Select the pest observed.');
      if (pestChoice === OTHER_VALUE && !pestOther.trim()) return setError('Specify the pest name.');
      if (!pestPhoto) return setError('A pest photo is required.');
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('demoPlotId', plot.id);
      form.append('actionPlan', actionPlan.trim());
      form.append('comments', comments.trim());
      form.append('issueTypeIds', JSON.stringify(selectedIssues));
      form.append('goodThingIds', JSON.stringify(selectedGoodThings));
      form.append('overallPhoto', assetToFormFile(overallPhoto));

      if (showDiseaseSection) {
        if (diseaseChoice === OTHER_VALUE) form.append('diseaseOther', diseaseOther.trim());
        else form.append('diseaseId', diseaseChoice);
        form.append('diseasePhoto', assetToFormFile(diseasePhoto));
      }
      if (showPestSection) {
        if (pestChoice === OTHER_VALUE) form.append('pestOther', pestOther.trim());
        else form.append('pestId', pestChoice);
        form.append('pestPhoto', assetToFormFile(pestPhoto));
      }
      for (const [issueId, asset] of Object.entries(issuePhotos)) {
        if (selectedIssues.includes(issueId)) form.append(`issuePhoto_${issueId}`, assetToFormFile(asset));
      }
      for (const [goodThingId, asset] of Object.entries(goodThingPhotos)) {
        if (selectedGoodThings.includes(goodThingId)) form.append(`goodThingPhoto_${goodThingId}`, assetToFormFile(asset));
      }

      await createVisit(token, form);
      Alert.alert('Visit logged', '', [{ text: 'OK', onPress: onSubmitted }]);
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
      <Text style={styles.title}>Log a Visit</Text>
      <Text style={styles.subLine}>{plot.farmer_name} — {plot.crop_name}</Text>

      <ChecklistWithPhotos
        title="Issues Observed Today"
        items={issueTypes}
        selectedIds={selectedIssues}
        onToggle={toggleIssue}
        photos={issuePhotos}
        onPickPhoto={pickIssuePhoto}
      />

      {showDiseaseSection && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Disease Observation</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={diseaseChoice} onValueChange={setDiseaseChoice}>
              <Picker.Item label="-- select disease --" value="" />
              {diseases.map((d) => <Picker.Item key={d.id} label={d.name} value={d.id} />)}
              <Picker.Item label="Other (please specify)" value={OTHER_VALUE} />
            </Picker>
          </View>
          {diseaseChoice === OTHER_VALUE && (
            <TextInput
              style={styles.input}
              value={diseaseOther}
              onChangeText={setDiseaseOther}
              placeholder="Disease name"
            />
          )}
          {diseasePhoto ? (
            <Image source={{ uri: diseasePhoto.uri }} style={styles.thumbLarge} />
          ) : (
            <Pressable style={styles.photoBtn} onPress={async () => setDiseasePhoto(await pickPhoto())}>
              <Text style={styles.photoBtnText}>+ Disease Photo (required)</Text>
            </Pressable>
          )}
        </View>
      )}

      {showPestSection && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pest Observation</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={pestChoice} onValueChange={setPestChoice}>
              <Picker.Item label="-- select pest --" value="" />
              {pests.map((p) => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
              <Picker.Item label="Other (please specify)" value={OTHER_VALUE} />
            </Picker>
          </View>
          {pestChoice === OTHER_VALUE && (
            <TextInput
              style={styles.input}
              value={pestOther}
              onChangeText={setPestOther}
              placeholder="Pest name"
            />
          )}
          {pestPhoto ? (
            <Image source={{ uri: pestPhoto.uri }} style={styles.thumbLarge} />
          ) : (
            <Pressable style={styles.photoBtn} onPress={async () => setPestPhoto(await pickPhoto())}>
              <Text style={styles.photoBtnText}>+ Pest Photo (required)</Text>
            </Pressable>
          )}
        </View>
      )}

      <ChecklistWithPhotos
        title="Good Things Observed Today"
        items={goodThings}
        selectedIds={selectedGoodThings}
        onToggle={toggleGoodThing}
        photos={goodThingPhotos}
        onPickPhoto={pickGoodThingPhoto}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Immediate Action Plan</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={actionPlan}
          onChangeText={setActionPlan}
          placeholder="Steps that will be taken to address what was observed"
          multiline
        />

        <Text style={styles.sectionLabel}>Observations & Remarks</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={comments}
          onChangeText={setComments}
          placeholder="Key observations from this visit"
          multiline
        />

        <Text style={styles.sectionLabel}>Visit Photo</Text>
        {overallPhoto ? (
          <Image source={{ uri: overallPhoto.uri }} style={styles.thumbLarge} />
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => setOverallPhoto(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Photo of the Plot (required)</Text>
          </Pressable>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Visit</Text>}
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
  checkRow: { marginBottom: 4 },
  checkRowMain: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 15, flex: 1 },
  photoRow: { marginLeft: 32, marginBottom: 8 },
  photoBtn: {
    borderWidth: 1, borderColor: '#2563eb', borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', marginTop: 6,
  },
  photoBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  thumb: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#f1f5f9' },
  thumbLarge: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#f1f5f9', marginTop: 6 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginTop: 8 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#dc2626', marginTop: 20 },
  submitButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
