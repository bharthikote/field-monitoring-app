import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { loadSession } from './src/session';

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        setUser(session.user);
        setScreen('home');
      } else {
        setScreen('login');
      }
    });
  }, []);

  if (screen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {screen === 'signup' && <SignUpScreen onGoToLogin={() => setScreen('login')} />}
      {screen === 'login' && (
        <LoginScreen
          onGoToSignUp={() => setScreen('signup')}
          onLoggedIn={(loggedInUser) => {
            setUser(loggedInUser);
            setScreen('home');
          }}
        />
      )}
      {screen === 'home' && user && (
        <HomeScreen user={user} onLoggedOut={() => setScreen('login')} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
