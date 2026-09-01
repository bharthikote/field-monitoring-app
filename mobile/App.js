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
import CreateFieldDayScreen from './src/screens/CreateFieldDayScreen';
import FarmersListScreen from './src/screens/FarmersListScreen';
import CreateFarmerScreen from './src/screens/CreateFarmerScreen';
import CreateFarmerDetailedScreen from './src/screens/CreateFarmerDetailedScreen';
import EditFarmerDetailedScreen from './src/screens/EditFarmerDetailedScreen';
import FarmerDetailScreen from './src/screens/FarmerDetailScreen';
import TfoFarmerDetailScreen from './src/screens/TfoFarmerDetailScreen';
import InstitutionsListScreen from './src/screens/InstitutionsListScreen';
import CreateInstitutionScreen from './src/screens/CreateInstitutionScreen';
import CreateInstitutionVisitScreen from './src/screens/CreateInstitutionVisitScreen';
import AgroDealersListScreen from './src/screens/AgroDealersListScreen';
import CreateAgroDealerScreen from './src/screens/CreateAgroDealerScreen';
import CreateAgroDealerVisitScreen from './src/screens/CreateAgroDealerVisitScreen';
import IssuesScreen from './src/screens/IssuesScreen';
import RaiseIssueScreen from './src/screens/RaiseIssueScreen';
import IssueDetailScreen from './src/screens/IssueDetailScreen';
import MessagingScreen from './src/screens/MessagingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BottomTabBar from './src/components/BottomTabBar';
import { loadSession } from './src/session';

// The five root screens the bottom tab bar switches between. The tab bar
// always shows on these; every other drill-down screen hides it (except
// 'lookup', which shows/hides it based on scroll direction - see
// lookupTabBarVisible below), same as it hides on login/signup/loading.
// No separate "Alerts" tab - Issues already serves that purpose for this app.
const TAB_SCREENS = ['home', 'issues', 'farmers', 'messaging', 'profile'];

// Mirrors every screen's own onBack prop below, so Android's hardware back
// button and edge-swipe gesture (which fire the same hardwareBackPress
// event) land on the same screen the on-screen "< Back" link would. Root
// tabs, login, and signup aren't listed - back there falls through to the
// OS default (minimize/exit), which is the expected behavior on a root screen.
// 'plot-detail' isn't listed - it can be reached from either the Demo Plot
// lookup flow or a farmer's activity list, so it's handled dynamically via
// plotDetailOrigin below instead of a fixed target. 'select-farmer' and
// 'create-farmer' (when reached mid-activity) are handled dynamically too,
// since 'create-farmer' is reused by both the Farmers tab and the
// Training/Field Day flow - see pendingActivityType below.
const BACK_MAP = {
  lookup: 'home',
  create: 'lookup',
  'raise-issue': 'plot-detail',
  'issue-detail': 'issues',
  'create-training': 'select-farmer',
  'create-field-day': 'select-farmer',
  'create-farmer': 'farmers',
  'farmer-detail': 'farmers',
  'edit-farmer': 'farmer-detail',
  'select-institution': 'home',
  'create-institution': 'select-institution',
  'create-institution-visit': 'select-institution',
  'select-agro-dealer': 'home',
  'create-agro-dealer': 'select-agro-dealer',
  'create-agro-dealer-visit': 'select-agro-dealer',
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
  // Training/Field Day now start by picking (or registering) a farmer
  // instead of typing their name/phone inline - pendingActivityType tracks
  // which of the two the user is logging, so the shared select-farmer/
  // create-farmer steps know where to continue once a farmer is chosen.
  const [pendingActivityType, setPendingActivityType] = useState(null);
  const [selectedFarmerForActivity, setSelectedFarmerForActivity] = useState(null);
  // Institutional Visit and Agro Dealer Visit each have their own
  // dedicated profile entity (not shared like farmers are between
  // Training/Field Day), so each gets its own linear select-or-create flow
  // with no pendingActivityType-style sharing needed.
  const [selectedInstitutionForVisit, setSelectedInstitutionForVisit] = useState(null);
  const [selectedDealerForVisit, setSelectedDealerForVisit] = useState(null);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  // Demo Plots is a drill-down screen, not a tab root, but it can still
  // show the tab bar - scroll down to hide it (more room for the list),
  // scroll up to bring it back. Reset to visible each time the screen is
  // entered fresh, so it doesn't start hidden from a previous visit.
  const [lookupTabBarVisible, setLookupTabBarVisible] = useState(true);

  useEffect(() => {
    loadSession()
      .then((session) => {
        if (session) {
          setUser(session.user);
          setToken(session.token);
          setScreen('home');
        } else {
          setScreen('login');
        }
      })
      .catch(() => setScreen('login'));
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'plot-detail') {
        setScreen(plotDetailOrigin);
        return true;
      }
      if (screen === 'select-farmer') {
        setPendingActivityType(null);
        setScreen('home');
        return true;
      }
      if (screen === 'create-farmer' && pendingActivityType) {
        setScreen('select-farmer');
        return true;
      }
      const target = BACK_MAP[screen];
      if (!target) return false;
      setScreen(target);
      return true;
    });
    return () => subscription.remove();
  }, [screen, plotDetailOrigin, pendingActivityType]);

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
          onCreateTraining={() => {
            setPendingActivityType('training');
            setScreen('select-farmer');
          }}
          onCreateFieldDay={() => {
            setPendingActivityType('fieldday');
            setScreen('select-farmer');
          }}
          onCreateInstitutionVisit={() => setScreen('select-institution')}
          onCreateAgroDealerVisit={() => setScreen('select-agro-dealer')}
        />
      )}
      {screen === 'select-farmer' && (
        <FarmersListScreen
          token={token}
          title={pendingActivityType === 'training' ? 'Select Farmer — Training' : 'Select Farmer — Field Day'}
          onBack={() => {
            setPendingActivityType(null);
            setScreen('home');
          }}
          onCreateNew={() => setScreen('create-farmer')}
          onSelectFarmer={(farmer) => {
            setSelectedFarmerForActivity(farmer);
            setScreen(pendingActivityType === 'training' ? 'create-training' : 'create-field-day');
          }}
        />
      )}
      {screen === 'create-training' && selectedFarmerForActivity && (
        <CreateTrainingScreen
          token={token}
          farmer={selectedFarmerForActivity}
          onBack={() => setScreen('select-farmer')}
          onCreated={() => {
            setPendingActivityType(null);
            setSelectedFarmerForActivity(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'create-field-day' && selectedFarmerForActivity && (
        <CreateFieldDayScreen
          token={token}
          farmer={selectedFarmerForActivity}
          onBack={() => setScreen('select-farmer')}
          onCreated={() => {
            setPendingActivityType(null);
            setSelectedFarmerForActivity(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'select-institution' && (
        <InstitutionsListScreen
          token={token}
          onBack={() => setScreen('home')}
          onCreateNew={() => setScreen('create-institution')}
          onSelectInstitution={(institution) => {
            setSelectedInstitutionForVisit(institution);
            setScreen('create-institution-visit');
          }}
        />
      )}
      {screen === 'create-institution' && (
        <CreateInstitutionScreen
          token={token}
          onBack={() => setScreen('select-institution')}
          onCreated={(institution) => {
            setSelectedInstitutionForVisit(institution);
            setScreen('create-institution-visit');
          }}
        />
      )}
      {screen === 'create-institution-visit' && selectedInstitutionForVisit && (
        <CreateInstitutionVisitScreen
          token={token}
          institution={selectedInstitutionForVisit}
          onBack={() => setScreen('select-institution')}
          onCreated={() => {
            setSelectedInstitutionForVisit(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'select-agro-dealer' && (
        <AgroDealersListScreen
          token={token}
          onBack={() => setScreen('home')}
          onCreateNew={() => setScreen('create-agro-dealer')}
          onSelectDealer={(dealer) => {
            setSelectedDealerForVisit(dealer);
            setScreen('create-agro-dealer-visit');
          }}
        />
      )}
      {screen === 'create-agro-dealer' && (
        <CreateAgroDealerScreen
          token={token}
          onBack={() => setScreen('select-agro-dealer')}
          onCreated={(dealer) => {
            setSelectedDealerForVisit(dealer);
            setScreen('create-agro-dealer-visit');
          }}
        />
      )}
      {screen === 'create-agro-dealer-visit' && selectedDealerForVisit && (
        <CreateAgroDealerVisitScreen
          token={token}
          dealer={selectedDealerForVisit}
          onBack={() => setScreen('select-agro-dealer')}
          onCreated={() => {
            setSelectedDealerForVisit(null);
            setScreen('home');
          }}
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
      {screen === 'create-farmer' && user.role === 'tfo' && (
        <CreateFarmerDetailedScreen
          token={token}
          onBack={() => setScreen('farmers')}
          onCreated={() => setScreen('farmers')}
        />
      )}
      {screen === 'create-farmer' && user.role !== 'tfo' && (
        <CreateFarmerScreen
          token={token}
          onBack={() => setScreen(pendingActivityType ? 'select-farmer' : 'farmers')}
          onCreated={(farmer) => {
            if (pendingActivityType) {
              setSelectedFarmerForActivity(farmer);
              setScreen(pendingActivityType === 'training' ? 'create-training' : 'create-field-day');
            } else {
              setScreen('farmers');
            }
          }}
        />
      )}
      {screen === 'farmer-detail' && selectedFarmer && user.role === 'tfo' && (
        <TfoFarmerDetailScreen
          token={token}
          farmer={selectedFarmer}
          onBack={() => setScreen('farmers')}
          onEdit={() => setScreen('edit-farmer')}
          onDeactivated={() => {
            setSelectedFarmer(null);
            setScreen('farmers');
          }}
        />
      )}
      {screen === 'edit-farmer' && selectedFarmer && user.role === 'tfo' && (
        <EditFarmerDetailedScreen
          token={token}
          farmer={selectedFarmer}
          onBack={() => setScreen('farmer-detail')}
          onSaved={(updated) => {
            setSelectedFarmer(updated);
            setScreen('farmer-detail');
          }}
        />
      )}
      {screen === 'farmer-detail' && selectedFarmer && user.role !== 'tfo' && (
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
