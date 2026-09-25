import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getDataCollectionForm, submitDataCollectionForm } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectField from '../components/MultiSelectField';
import DatePickerField from '../components/DatePickerField';
import { pickPhoto, assetToFormFile } from '../photo';
import { useGps, appendGps } from '../gps';
import GpsStatus from '../components/GpsStatus';
import { COLORS } from '../theme';

function toOptionList(options) {
  return (options || []).map((o) => ({ id: o, name: o }));
}

// One field's input, dispatched purely on field_type - the same eight types
// the web admin's form builder offers, so whatever Super Admin builds there
// always has a matching renderer here.
function FieldInput({ field, value, onChange }) {
  if (field.field_type === 'textarea') {
    return <TextInput style={[styles.input, styles.textarea]} value={value || ''} onChangeText={onChange} multiline />;
  }
  if (field.field_type === 'number') {
    return <TextInput style={styles.input} value={value || ''} onChangeText={onChange} keyboardType="number-pad" />;
  }
  if (field.field_type === 'phone') {
    return <TextInput style={styles.input} value={value || ''} onChangeText={onChange} keyboardType="phone-pad" />;
  }
  if (field.field_type === 'date') {
    return <DatePickerField value={value || ''} onChange={onChange} />;
  }
  if (field.field_type === 'select') {
    return <SearchableSelect options={toOptionList(field.options)} value={value} onChange={onChange} />;
  }
  if (field.field_type === 'multiselect') {
    return (
      <MultiSelectField
        placeholder="-- select --"
        options={toOptionList(field.options)}
        selectedIds={value || []}
        onChange={onChange}
      />
    );
  }
  if (field.field_type === 'photo') {
    return (
      <View>
        {value ? (
          <View>
            <Image source={{ uri: value.uri }} style={styles.photoPreview} />
            <Pressable onPress={async () => onChange(await pickPhoto())}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => onChange(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Add Photo</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return <TextInput style={styles.input} value={value || ''} onChangeText={onChange} />;
}

export default function FillDataCollectionFormScreen({ token, form, farmer, onBack, onSubmitted }) {
  const [fields, setFields] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const gps = useGps();

  useEffect(() => {
    getDataCollectionForm(token, form.id)
      .then((data) => setFields(data.fields))
      .catch((err) => setLoadError(err.message));
  }, [token, form.id]);

  const setFieldValue = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    for (const field of fields) {
      const value = values[field.id];
      const isEmpty = field.field_type === 'multiselect' ? !value || value.length === 0
        : field.field_type === 'photo' ? !value
        : !value || !String(value).trim();
      if (field.required && isEmpty) {
        setError(`${field.label} is required.`);
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('farmerId', farmer.id);
      appendGps(body, await gps.getForSubmit());
      for (const field of fields) {
        const value = values[field.id];
        if (value === undefined || value === null) continue;
        if (field.field_type === 'photo') {
          body.append(`photo_${field.id}`, assetToFormFile(value));
        } else if (field.field_type === 'multiselect') {
          if (value.length > 0) body.append(`field_${field.id}`, JSON.stringify(value));
        } else if (String(value).trim()) {
          body.append(`field_${field.id}`, String(value).trim());
        }
      }
      await submitDataCollectionForm(token, form.id, body);
      Alert.alert('Submitted', 'This form has been recorded.', [{ text: 'OK', onPress: onSubmitted }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{form.title}</Text>
        <Text style={styles.subtitle}>For {farmer.name} · {farmer.phone}</Text>
      </View>

      {loadError ? (
        <Text style={styles.error}>{loadError}</Text>
      ) : !fields ? (
        <ActivityIndicator style={styles.loadingIndicator} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.container}>
            {fields.length === 0 && <Text style={styles.empty}>This form has no fields yet.</Text>}
            {fields.map((field) => (
              <View key={field.id}>
                <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
                <FieldInput field={field} value={values[field.id]} onChange={(v) => setFieldValue(field.id, v)} />
              </View>
            ))}
            <GpsStatus gps={gps} label="Location" />
          </ScrollView>

          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.buttonRow}>
              <Pressable style={styles.saveButton} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Submit</Text>}
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={onBack} disabled={submitting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  container: { padding: 24, paddingBottom: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  loadingIndicator: { marginTop: 40 },
  empty: { color: COLORS.textMuted },
  photoBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, borderStyle: 'dashed',
    padding: 16, alignItems: 'center',
  },
  photoBtnText: { color: COLORS.textMuted, fontSize: 14 },
  photoPreview: { width: 96, height: 96, borderRadius: 12 },
  changePhotoText: { color: COLORS.primary, fontWeight: '600', fontSize: 13, marginTop: 8 },
  error: { color: COLORS.danger, marginBottom: 12, marginTop: 8 },
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#e6e4de', backgroundColor: '#fff',
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  saveButton: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancelButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.danger,
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  cancelButtonText: { color: COLORS.danger, fontWeight: '600', fontSize: 16 },
});
