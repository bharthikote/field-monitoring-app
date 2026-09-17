import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
// expo-contacts' modern (non-legacy) API replaced requestPermissionsAsync /
// getContactsAsync / Fields with a class-based Contact API as of SDK 57 -
// the old names still exist under this import but throw at runtime from the
// main entry point. This keeps the original, well-established pair working
// instead of rewriting against the new API.
import * as Contacts from 'expo-contacts/legacy';
import Svg, { Rect, Circle, Line, Path } from 'react-native-svg';
import { COLORS } from '../theme';

function ContactIcon({ color }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="4" width="20" height="16" rx="2" />
      <Circle cx="9" cy="10" r="2" />
      <Path d="M6 16c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5" />
      <Path d="M15 9h4M15 13h4" />
    </Svg>
  );
}

function SearchIcon({ color }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

// A phone number field with a "pick from contacts" button beside it -
// typing a full number on a mobile keyboard is slow and error-prone.
// Fetches the contact list ourselves and shows it in the same searchable
// bottom-sheet pattern as SearchableSelect, rather than handing off to the
// OS's own contact-picker screen (presentContactPickerAsync) - that native
// picker crashed the whole app on-device under Expo Go, so this sticks to
// expo-contacts' older, far more established requestPermissionsAsync +
// getContactsAsync pair instead.
// onPickName is optional - callers that also have a name field can use it
// to auto-fill from the picked contact.
export default function ContactPhoneField({ label = 'Phone Number', value, onChangeText, onPickName }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access to pick a phone number, or type it in below.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      const withPhones = (data || [])
        .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      setContacts(withPhones);
      setQuery('');
      setOpen(true);
    } catch (err) {
      Alert.alert('Could not open contacts', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, query]);

  const handleSelect = (contact) => {
    const rawNumber = contact.phoneNumbers?.[0]?.number;
    if (rawNumber) onChangeText(rawNumber.replace(/\D/g, ''));
    if (contact.name && onPickName) onPickName(contact.name);
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
        />
        <Pressable style={styles.contactButton} onPress={handleOpen} disabled={loading} hitSlop={8}>
          {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <ContactIcon color={COLORS.primary} />}
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.searchRow}>
              <SearchIcon color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search contacts..."
                autoFocus
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => handleSelect(item)}>
                  <Text style={styles.optionName}>{item.name}</Text>
                  <Text style={styles.optionPhone}>{item.phoneNumbers[0].number}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No contacts with a phone number found.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, paddingRight: 44, fontSize: 16 },
  contactButton: { position: 'absolute', right: 10, padding: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  optionRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  optionName: { fontSize: 15, color: '#111', fontWeight: '600' },
  optionPhone: { fontSize: 13, color: '#888', marginTop: 2 },
  emptyText: { padding: 20, textAlign: 'center', color: '#888' },
});
