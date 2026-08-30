import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import DemoPlotLookupScreen from './src/screens/DemoPlotLookupScreen';
import CreateDemoPlotScreen from './src/screens/CreateDemoPlotScreen';
import DemoPlotDetailScreen from './src/screens/DemoPlotDetailScreen';
import CreateTrainingScreen from './src/screens/CreateTrainingScreen';
import FarmersListScreen from './src/screens/FarmersListScreen';
import CreateFarmerScreen from './src/screens/CreateFarmerScreen';
import FarmerDetailScreen from './src/screens/FarmerDetailScreen';
import IssuesScreen from './src/screens/IssuesScreen';
import RaiseIssueScreen from './src/screens/RaiseIssueScreen';
import IssueDetailScreen from './src/screens/IssueDetailScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import MessagingScreen from './src/screens/MessagingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BottomTabBar from './src/components/BottomTabBar';
import { loadSession } from './src/session';

// The six root screens the bottom tab bar switches between. The tab bar
// always shows on these; every other drill-down screen hides it (except
// 'lookup', which shows/hides it based on scroll direction - see
// lookupTabBarVisible below), same as it hides on login/signup/loading.
const TAB_SCREENS = ['home', 'issues', 'farmers', 'notifications', 'messaging', 'profile'];

// Mirrors every screen's own onBack prop below, so Android's hardware back
// button and edge-swipe gesture (which fire the same hardwareBackPress
// event) land on the same screen the on-screen "< Back" link would. Root
// tabs, login, and signup aren't listed - back there falls through to the
// OS default (minimize/exit), which is the expected behavior on a root screen.
// 'plot-detail' isn't listed - it can be reached from either the Demo Plot
// lookup flow or a farmer's activity list, so it's handled dynamically via
// plotDetailOrigin below instead of a fixed target.
const BACK_MAP = {
  lookup: 'home',
  create: 'lookup',
  'raise-issue': 'plot-detail',
  'issue-detail': 'issues',
  'create-training': 'home',
  'create-farmer': 'farmers',
  'farmer-detail': 'farmers',
};

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [createPhone, setCreatePhone] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [plotType, setPlotType] = useState('demo');
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [plotDetailOrigin, setPlotDetailOrigin] = useState('lookup');
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  // Demo Plots is a drill-down screen, not a tab root, but it can still
  // show the tab bar - scroll down to hide it (more room for the list),
  // scroll up to bring it back. Reset to visible each time the screen is
  // entered fresh, so it doesn't start hidden from a previous visit.
  const [lookupTabBarVisible, setLookupTabBarVisible] = useState(true);

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
      if (screen === 'plot-detail') {
        setScreen(plotDetailOrigin);
        return true;
      }
      const target = BACK_MAP[screen];
      if (!target) return false;
      setScreen(target);
      return true;
    });
    return () => subscription.remove();
  }, [screen, plotDetailOrigin]);

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
          onFindDemoPlot={(type) => {
            setPlotType(type);
            setLookupPhone('');
            setLookupTabBarVisible(true);
            setScreen('lookup');
          }}
          onCreateTraining={() => setScreen('create-training')}
        />
      )}
      {screen === 'create-training' && (
        <CreateTrainingScreen
          token={token}
          onBack={() => setScreen('home')}
          onCreated={() => setScreen('home')}
        />
      )}
      {screen === 'lookup' && (
        <DemoPlotLookupScreen
          token={token}
          plotType={plotType}
          initialPhone={lookupPhone}
          onBack={() => setScreen('home')}
          onScrollDirectionChange={setLookupTabBarVisible}
          onCreateNew={(phone) => {
            setCreatePhone(phone);
            setScreen('create');
          }}
          onSelectPlot={(plot) => {
            setSelectedPlot(plot);
            setPlotDetailOrigin('lookup');
            setScreen('plot-detail');
          }}
        />
      )}
      {screen === 'create' && (
        <CreateDemoPlotScreen
          token={token}
          plotType={plotType}
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
          onBack={() => setScreen(plotDetailOrigin)}
          onRaiseIssue={(plot) => {
            setSelectedPlot(plot);
            setScreen('raise-issue');
          }}
        />
      )}
      {screen === 'farmers' && (
        <FarmersListScreen
          token={token}
          onCreateNew={() => setScreen('create-farmer')}
          onSelectFarmer={(farmer) => {
            setSelectedFarmer(farmer);
            setScreen('farmer-detail');
          }}
        />
      )}
      {screen === 'create-farmer' && (
        <CreateFarmerScreen
          token={token}
          onBack={() => setScreen('farmers')}
          onCreated={() => setScreen('farmers')}
        />
      )}
      {screen === 'farmer-detail' && selectedFarmer && (
        <FarmerDetailScreen
          token={token}
          farmer={selectedFarmer}
          onBack={() => setScreen('farmers')}
          onSelectPlot={(plot) => {
            setSelectedPlot(plot);
            setPlotDetailOrigin('farmer-detail');
            setScreen('plot-detail');
          }}
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

      {user && (TAB_SCREENS.includes(screen) || (screen === 'lookup' && lookupTabBarVisible)) && (
        <BottomTabBar active={TAB_SCREENS.includes(screen) ? screen : 'home'} onChange={setScreen} />
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
