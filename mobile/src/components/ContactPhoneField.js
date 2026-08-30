import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
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

// A phone number field with a "pick from contacts" button beside it -
// typing a full number on a mobile keyboard is slow and error-prone.
// presentContactPickerAsync launches the OS's own contact picker and hands
// back only the one contact tapped, so it needs no separate permission
// request first (unlike reading the whole contact list would).
// onPickName is optional - callers that also have a name field can use it
// to auto-fill from the picked contact.
export default function ContactPhoneField({ label = 'Phone Number', value, onChangeText, onPickName }) {
  const [picking, setPicking] = useState(false);

  const handlePickContact = async () => {
    setPicking(true);
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const rawNumber = contact.phoneNumbers?.[0]?.number;
      if (!rawNumber) {
        Alert.alert('No phone number', `${contact.name || 'That contact'} doesn't have a phone number saved.`);
        return;
      }
      onChangeText(rawNumber.replace(/\D/g, ''));
      if (contact.name && onPickName) onPickName(contact.name);
    } catch (err) {
      Alert.alert('Could not open contacts', err.message);
    } finally {
      setPicking(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.inputWithButton]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
        />
        <Pressable style={styles.contactButton} onPress={handlePickContact} disabled={picking}>
          <ContactIcon color={COLORS.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  inputWithButton: { flex: 1 },
  contactButton: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#ccc',
    alignItems: 'center', justifyContent: 'center',
  },
});
