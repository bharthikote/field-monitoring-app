import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import DemoPlotLookupScreen from './src/screens/DemoPlotLookupScreen';
import CreateDemoPlotScreen from './src/screens/CreateDemoPlotScreen';
import DemoPlotDetailScreen from './src/screens/DemoPlotDetailScreen';
import LogVisitScreen from './src/screens/LogVisitScreen';
import IssuesScreen from './src/screens/IssuesScreen';
import RaiseIssueScreen from './src/screens/RaiseIssueScreen';
import IssueDetailScreen from './src/screens/IssueDetailScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import MessagingScreen from './src/screens/MessagingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BottomTabBar from './src/components/BottomTabBar';
import { loadSession } from './src/session';

// The five root screens the bottom tab bar switches between. The tab bar
// only shows on these - every drill-down screen (demo plot lookup/create/
// detail, log visit, raise issue, issue detail) hides it, same as it hides
// on login/signup/loading.
const TAB_SCREENS = ['home', 'issues', 'notifications', 'messaging', 'profile'];

// Mirrors every screen's own onBack prop below, so Android's hardware back
// button and edge-swipe gesture (which fire the same hardwareBackPress
// event) land on the same screen the on-screen "< Back" link would. Root
// tabs, login, and signup aren't listed - back there falls through to the
// OS default (minimize/exit), which is the expected behavior on a root screen.
const BACK_MAP = {
  lookup: 'home',
  create: 'lookup',
  'plot-detail': 'lookup',
  'log-visit': 'plot-detail',
  'raise-issue': 'plot-detail',
  'issue-detail': 'issues',
};

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [createPhone, setCreatePhone] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        setUser(session.user);
        setToken(session.token);
        setScreen('home');
      } else {
        setScreen('login');
      }
    });
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const target = BACK_MAP[screen];
      if (!target) return false;
      setScreen(target);
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  if (screen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
      {screen === 'signup' && <SignUpScreen onGoToLogin={() => setScreen('login')} />}
      {screen === 'login' && (
        <LoginScreen
          onGoToSignUp={() => setScreen('signup')}
          onLoggedIn={(loggedInUser, loggedInToken) => {
            setUser(loggedInUser);
            setToken(loggedInToken);
            setScreen('home');
          }}
        />
      )}
      {screen === 'home' && user && (
        <HomeScreen
          token={token}
          user={user}
          onFindDemoPlot={() => {
            setLookupPhone('');
            setScreen('lookup');
          }}
        />
      )}
      {screen === 'lookup' && (
        <DemoPlotLookupScreen
          token={token}
          initialPhone={lookupPhone}
          onBack={() => setScreen('home')}
          onCreateNew={(phone) => {
            setCreatePhone(phone);
            setScreen('create');
          }}
          onSelectPlot={(plot) => {
            setSelectedPlot(plot);
            setScreen('plot-detail');
          }}
        />
      )}
      {screen === 'create' && (
        <CreateDemoPlotScreen
          token={token}
          user={user}
          initialPhone={createPhone}
          onBack={() => setScreen('lookup')}
          onCreated={(phone) => {
            setLookupPhone(phone);
            setScreen('lookup');
          }}
        />
      )}
      {screen === 'plot-detail' && selectedPlot && (
        <DemoPlotDetailScreen
          token={token}
          user={user}
          plot={selectedPlot}
          onBack={() => setScreen('lookup')}
          onLogVisit={(plot) => {
            setSelectedPlot(plot);
            setScreen('log-visit');
          }}
          onRaiseIssue={(plot) => {
            setSelectedPlot(plot);
            setScreen('raise-issue');
          }}
        />
      )}
      {screen === 'log-visit' && selectedPlot && (
        <LogVisitScreen
          token={token}
          plot={selectedPlot}
          onBack={() => setScreen('plot-detail')}
          onSubmitted={() => setScreen('plot-detail')}
        />
      )}
      {screen === 'raise-issue' && selectedPlot && (
        <RaiseIssueScreen
          token={token}
          user={user}
          plot={selectedPlot}
          onBack={() => setScreen('plot-detail')}
          onSubmitted={() => setScreen('plot-detail')}
        />
      )}
      {screen === 'issues' && user && (
        <IssuesScreen
          token={token}
          user={user}
          onSelectIssue={(issueId) => {
            setSelectedIssueId(issueId);
            setScreen('issue-detail');
          }}
        />
      )}
      {screen === 'issue-detail' && selectedIssueId && (
        <IssueDetailScreen
          token={token}
          user={user}
          issueId={selectedIssueId}
          onBack={() => setScreen('issues')}
        />
      )}
      {screen === 'notifications' && <NotificationsScreen />}
      {screen === 'messaging' && <MessagingScreen />}
      {screen === 'profile' && user && (
        <ProfileScreen user={user} onLoggedOut={() => setScreen('login')} />
      )}
      </View>

      {user && TAB_SCREENS.includes(screen) && (
        <BottomTabBar active={screen} onChange={setScreen} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
