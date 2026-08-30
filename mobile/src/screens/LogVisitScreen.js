import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { listIssueTypes, listGoodThings, listDiseases, listPests, createVisit } from '../api';
import { COLORS } from '../theme';
import MultiSelectField from '../components/MultiSelectField';
import SearchableSelect from '../components/SearchableSelect';

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

export default function LogVisitScreen({ token, plot, onSubmitted }) {
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
      <MultiSelectField
        label="Issues Observed Today"
        placeholder="-- select issues observed --"
        options={issueTypes}
        selectedIds={selectedIssues}
        onChange={setSelectedIssues}
        onPhotoPress={pickIssuePhoto}
        hasPhoto={(id) => !!issuePhotos[id]}
      />

      {showDiseaseSection && (
        <View style={styles.section}>
          <SearchableSelect
            label="Disease Observation"
            placeholder="-- select disease --"
            options={[...diseases, { id: OTHER_VALUE, name: 'Other (please specify)' }]}
            value={diseaseChoice}
            onChange={setDiseaseChoice}
          />
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
          <SearchableSelect
            label="Pest Observation"
            placeholder="-- select pest --"
            options={[...pests, { id: OTHER_VALUE, name: 'Other (please specify)' }]}
            value={pestChoice}
            onChange={setPestChoice}
          />
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

      <MultiSelectField
        label="Good Things Observed Today"
        placeholder="-- select good things observed --"
        options={goodThings}
        selectedIds={selectedGoodThings}
        onChange={setSelectedGoodThings}
        onPhotoPress={pickGoodThingPhoto}
        hasPhoto={(id) => !!goodThingPhotos[id]}
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
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  photoBtn: {
    borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', marginTop: 6,
  },
  photoBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  thumbLarge: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#f1f5f9', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginTop: 8 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: COLORS.danger, marginTop: 20 },
  submitButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
