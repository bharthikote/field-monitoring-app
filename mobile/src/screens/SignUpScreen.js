import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { register } from '../api';
import { ROLES } from '../roles';
import { COLORS } from '../theme';

export default function SignUpScreen({ onGoToLogin }) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES[0].value);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !identifier || !password) {
      Alert.alert('Missing info', 'Please fill in your name, mobile/email, and password.');
      return;
    }
    setLoading(true);
    try {
      await register(name, identifier, password, role);
      Alert.alert(
        'Account created',
        'Your account is pending Admin approval. You will be able to log in once approved.',
        [{ text: 'OK', onPress: onGoToLogin }],
      );
    } catch (err) {
      Alert.alert('Sign up failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" />

      <Text style={styles.label}>Mobile Number or Email</Text>
      <TextInput
        style={styles.input}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.label}>Role</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={role} onValueChange={setRole}>
          {ROLES.map((r) => (
            <Picker.Item key={r.value} label={r.label} value={r.value} />
          ))}
        </Picker>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </Pressable>

      <Pressable onPress={onGoToLogin}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: COLORS.primary, textAlign: 'center', marginTop: 16 },
});
