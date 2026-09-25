import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { login } from '../api';
import { saveSession } from '../session';
import { COLORS } from '../theme';

export default function LoginScreen({ onGoToSignUp, onLoggedIn }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!identifier || !password) {
      Alert.alert('Missing info', 'Please enter your mobile/email and password.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await login(identifier, password);
      await saveSession({ token, user });
      onLoggedIn(user, token);
    } catch (err) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>

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

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </Pressable>

      <Pressable onPress={onGoToSignUp}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert('Forgot password?', 'Ask a Super Admin to reset your password for you.')
        }
      >
        <Text style={styles.forgotLink}>Forgot password?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: COLORS.primary, textAlign: 'center', marginTop: 16 },
  forgotLink: { color: '#888', textAlign: 'center', marginTop: 20, fontSize: 13 },
});
