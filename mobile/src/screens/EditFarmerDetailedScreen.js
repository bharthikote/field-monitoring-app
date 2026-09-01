import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { updateFarmer } from '../api';
import LocationPicker from '../components/LocationPicker';
import ContactPhoneField from '../components/ContactPhoneField';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectField from '../components/MultiSelectField';
import DatePickerField from '../components/DatePickerField';
import { pickPhoto, assetToFormFile } from '../photo';
import { COLORS } from '../theme';

// Same field set/options as CreateFarmerDetailedScreen - this is that same
// form pre-filled from an existing farmer, submitting a PATCH instead of a
// POST.
const FARMER_TYPES = [
  { id: 'key_farmer', name: 'Key Farmer' },
  { id: 'core_farmer', name: 'Core Farmer' },
  { id: 'farmer', name: 'Farmer' },
  { id: 'community_trainer_farmer', name: 'Community Trainer Farmer' },
];
const GENDERS = [
  { id: 'male', name: 'Male' },
  { id: 'female', name: 'Female' },
  { id: 'others', name: 'Others' },
];
const EDUCATION_LEVELS = [
  { id: 'primary', name: 'Primary' },
  { id: 'secondary', name: 'Secondary' },
  { id: 'higher', name: 'Higher' },
  { id: 'adult', name: 'Adult' },
  { id: 'no_school', name: 'No School' },
];
const LITERACY_OPTIONS = [
  { id: 'yes', name: 'Yes' },
  { id: 'no', name: 'No' },
];
const PHONE_TYPES = [
  { id: 'smartphone', name: 'Smart Phone' },
  { id: 'cellphone', name: 'Cell Phone' },
  { id: 'no_phone', name: 'No Phone' },
];
const SOCIAL_MEDIA_PLATFORMS = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'snapchat', name: 'Snapchat' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'twitter', name: 'Twitter' },
];

const MIN_AGE = 15;
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function EditFarmerDetailedScreen({ token, farmer, onBack, onSaved }) {
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState(farmer.name || '');
  const [farmerType, setFarmerType] = useState(farmer.farmer_type || null);
  const [gender, setGender] = useState(farmer.gender || null);
  const [age, setAge] = useState(farmer.age != null ? String(farmer.age) : '');
  const [birthDate, setBirthDate] = useState(farmer.birth_date || '');
  const [phone, setPhone] = useState(farmer.phone || '');
  const [villageId, setVillageId] = useState(farmer.village_id || null);
  const [address, setAddress] = useState(farmer.address || '');
  const [educationLevel, setEducationLevel] = useState(farmer.education_level || null);
  const [literacy, setLiteracy] = useState(farmer.literacy || null);
  const [phoneType, setPhoneType] = useState(farmer.phone_type || null);
  const [socialMedia, setSocialMedia] = useState(farmer.social_media || []);
  const [email, setEmail] = useState(farmer.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAgeChange = (text) => {
    setAge(text);
    const ageNum = Number(text);
    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE) return;
    const today = new Date();
    const year = today.getFullYear() - ageNum;
    const [, existingMonth, existingDay] = birthDate
      ? birthDate.split('-')
      : [null, pad2(today.getMonth() + 1), pad2(today.getDate())];
    setBirthDate(`${year}-${existingMonth}-${existingDay}`);
  };

  const handleSubmit = async () => {
    const ageNum = Number(age);
    if (
      !name.trim() || !farmerType || !gender || !age || !birthDate || !phone.trim()
      || !villageId || !educationLevel || !literacy || !phoneType
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE) {
      setError(`Age must be a whole number of ${MIN_AGE} or above.`);
      return;
    }
    if (email.trim() && !EMAIL_LIKE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('phone', phone.trim());
      form.append('villageId', villageId);
      form.append('farmerType', farmerType);
      form.append('gender', gender);
      form.append('age', age);
      form.append('birthDate', birthDate);
      if (address.trim()) form.append('address', address.trim());
      form.append('educationLevel', educationLevel);
      form.append('literacy', literacy);
      form.append('phoneType', phoneType);
      if (socialMedia.length > 0) form.append('socialMedia', JSON.stringify(socialMedia));
      if (email.trim()) form.append('email', email.trim());
      if (photo) form.append('photo', assetToFormFile(photo));

      const updated = await updateFarmer(token, farmer.id, form);
      Alert.alert('Farmer updated', '', [{ text: 'OK', onPress: () => onSaved(updated.farmer) }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const displayedPhotoUri = photo ? photo.uri : farmer.photo_url;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Edit Farmer</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Farmer Photo</Text>
        {displayedPhotoUri ? (
          <View>
            <Image source={{ uri: displayedPhotoUri }} style={styles.photoPreview} />
            <Pressable onPress={async () => setPhoto(await pickPhoto())}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await pickPhoto())}>
            <Text style={styles.photoBtnText}>+ Add Photo (optional)</Text>
          </Pressable>
        )}

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <ContactPhoneField
          label="Phone Number *"
          value={phone}
          onChangeText={setPhone}
          onPickName={(pickedName) => setName((prev) => (prev.trim() ? prev : pickedName))}
        />

        <SearchableSelect label="Type *" options={FARMER_TYPES} value={farmerType} onChange={setFarmerType} />

        <SearchableSelect label="Gender *" options={GENDERS} value={gender} onChange={setGender} />

        <Text style={styles.label}>Age *</Text>
        <TextInput style={styles.input} value={age} onChangeText={handleAgeChange} keyboardType="number-pad" maxLength={3} />

        <DatePickerField label="Birth Date *" value={birthDate} onChange={setBirthDate} />

        <LocationPicker
          token={token}
          onVillageChange={setVillageId}
          initialVillage={{
            id: farmer.village_id,
            name: farmer.village_name,
            block_name: farmer.block_name,
            district_name: farmer.district_name,
            state_name: farmer.state_name,
            country_name: farmer.country_name,
          }}
        />

        <Text style={styles.label}>Address Details</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Optional" />

        <SearchableSelect label="Educational Level *" options={EDUCATION_LEVELS} value={educationLevel} onChange={setEducationLevel} />

        <SearchableSelect label="Literacy *" options={LITERACY_OPTIONS} value={literacy} onChange={setLiteracy} />

        <SearchableSelect label="Phone Type *" options={PHONE_TYPES} value={phoneType} onChange={setPhoneType} />

        <MultiSelectField
          label="Social Media"
          placeholder="-- select platforms --"
          options={SOCIAL_MEDIA_PLATFORMS}
          selectedIds={socialMedia}
          onChange={setSocialMedia}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable style={styles.saveButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onBack} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.footnote}>* Required Fields</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  container: { padding: 24, paddingBottom: 24 },
  back: { color: COLORS.primary, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  photoBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, borderStyle: 'dashed',
    padding: 16, alignItems: 'center',
  },
  photoBtnText: { color: COLORS.textMuted, fontSize: 14 },
  photoPreview: { width: 96, height: 96, borderRadius: 12 },
  changePhotoText: { color: COLORS.primary, fontWeight: '600', fontSize: 13, marginTop: 8 },
  error: { color: COLORS.danger, marginBottom: 12 },
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
  footnote: { color: COLORS.textMuted, fontSize: 12, marginTop: 12 },
});
