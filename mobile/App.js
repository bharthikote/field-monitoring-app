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
import DataCollectionFormsListScreen from './src/screens/DataCollectionFormsListScreen';
import FillDataCollectionFormScreen from './src/screens/FillDataCollectionFormScreen';
import CreateTfoDemoScreen from './src/screens/CreateTfoDemoScreen';
import TfoDemosListScreen from './src/screens/TfoDemosListScreen';
import TfoDemoDetailScreen from './src/screens/TfoDemoDetailScreen';
import CreateHomeGardenScreen from './src/screens/CreateHomeGardenScreen';
import HomeGardensListScreen from './src/screens/HomeGardensListScreen';
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
  'data-collection': 'home',
  'select-farmer-for-form': 'data-collection',
  'fill-data-collection-form': 'select-farmer-for-form',
  'tfo-demos-list': 'home',
  'tfo-select-farmer-for-demo': 'tfo-demos-list',
  // 'create-tfo-demo' isn't listed here - it's reachable from either the
  // demos-list farmer-picker or directly from a Farmer Profile's Create
  // Demo button, so its back target is handled dynamically via
  // demoFormOrigin below, same pattern plotDetailOrigin already uses for
  // 'plot-detail'.
  'tfo-homegardens-list': 'home',
  'tfo-select-farmer-for-homegarden': 'tfo-homegardens-list',
  // 'create-tfo-homegarden' isn't listed here either - same dynamic-origin
  // handling as 'create-tfo-demo', via homeGardenFormOrigin.
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
  // Data Enumerator's Data Collection flow: pick a form, then a farmer,
  // then fill it out - same linear select-then-fill shape as Institutional
  // Visit/Agro Dealer Visit above.
  const [selectedDataCollectionForm, setSelectedDataCollectionForm] = useState(null);
  const [selectedFarmerForDataCollection, setSelectedFarmerForDataCollection] = useState(null);
  // TFO's own Demo Plot flow: pick a farmer, then fill out the richer TFO
  // demo form - same linear select-then-fill shape as Data Collection above.
  // Reachable two ways (Demos list's farmer-picker, or a Farmer Profile's
  // own Create Demo button skipping the picker) - demoFormOrigin tracks
  // which, so 'create-tfo-demo' knows where Back/Cancel/onCreated should
  // land, same role plotDetailOrigin plays for 'plot-detail'.
  const [selectedFarmerForTfoDemo, setSelectedFarmerForTfoDemo] = useState(null);
  const [demoFormOrigin, setDemoFormOrigin] = useState('tfo-select-farmer-for-demo');
  // Set only when editing an existing demo (the { demo, crops } payload
  // from GET /tfo-demos/:id) - null means CreateTfoDemoScreen is in create
  // mode. Cleared explicitly at every screen that starts a fresh create, so
  // a stale edit from a previous visit can never leak into a new demo.
  const [editingTfoDemo, setEditingTfoDemo] = useState(null);
  // Demo Monitoring page - reachable from the Demos list or a Farmer
  // Profile's Demo tab, same dynamic-origin shape as 'plot-detail'.
  const [selectedTfoDemoId, setSelectedTfoDemoId] = useState(null);
  const [demoDetailOrigin, setDemoDetailOrigin] = useState('tfo-demos-list');
  // TFO's Home Garden flow - same two-entry-point shape as Demo Plot above.
  const [selectedFarmerForHomeGarden, setSelectedFarmerForHomeGarden] = useState(null);
  const [homeGardenFormOrigin, setHomeGardenFormOrigin] = useState('tfo-select-farmer-for-homegarden');
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
      if (screen === 'create-tfo-demo') {
        setScreen(demoFormOrigin);
        return true;
      }
      if (screen === 'create-tfo-homegarden') {
        setScreen(homeGardenFormOrigin);
        return true;
      }
      if (screen === 'tfo-demo-detail') {
        setScreen(demoDetailOrigin);
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
  }, [screen, plotDetailOrigin, pendingActivityType, demoFormOrigin, homeGardenFormOrigin, demoDetailOrigin]);

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
          onOpenDataCollection={() => setScreen('data-collection')}
          onCreateTfoDemo={() => setScreen('tfo-demos-list')}
          onCreateHomeGarden={() => setScreen('tfo-homegardens-list')}
        />
      )}
      {screen === 'tfo-demos-list' && (
        <TfoDemosListScreen
          token={token}
          onBack={() => setScreen('home')}
          onCreateNew={() => {
            setEditingTfoDemo(null);
            setDemoFormOrigin('tfo-select-farmer-for-demo');
            setScreen('tfo-select-farmer-for-demo');
          }}
          onSelectDemo={(demo) => {
            setSelectedTfoDemoId(demo.id);
            setDemoDetailOrigin('tfo-demos-list');
            setScreen('tfo-demo-detail');
          }}
        />
      )}
      {screen === 'tfo-select-farmer-for-demo' && (
        <FarmersListScreen
          token={token}
          title="Select Farmer — Demo"
          onBack={() => setScreen('tfo-demos-list')}
          onSelectFarmer={(farmer) => {
            setSelectedFarmerForTfoDemo(farmer);
            setEditingTfoDemo(null);
            setScreen('create-tfo-demo');
          }}
        />
      )}
      {screen === 'create-tfo-demo' && selectedFarmerForTfoDemo && (
        <CreateTfoDemoScreen
          token={token}
          farmer={selectedFarmerForTfoDemo}
          demo={editingTfoDemo}
          onBack={() => setScreen(demoFormOrigin)}
          onCreated={() => {
            // On success, skip back past the farmer-picker step straight to
            // the Demos list (when that's how this was reached) rather than
            // making the user step through it again - same shortcut Data
            // Collection's onSubmitted already takes below. Editing an
            // existing demo lands back on its own detail page instead,
            // since demoFormOrigin is 'tfo-demo-detail' in that case.
            const returnTo = demoFormOrigin === 'tfo-select-farmer-for-demo' ? 'tfo-demos-list' : demoFormOrigin;
            setSelectedFarmerForTfoDemo(null);
            setEditingTfoDemo(null);
            setScreen(returnTo);
          }}
        />
      )}
      {screen === 'tfo-demo-detail' && selectedTfoDemoId && (
        <TfoDemoDetailScreen
          token={token}
          user={user}
          demoId={selectedTfoDemoId}
          onBack={() => setScreen(demoDetailOrigin)}
          onEdit={(data) => {
            setSelectedFarmerForTfoDemo({
              id: data.demo.farmer_id, name: data.demo.farmer_name, phone: data.demo.farmer_phone,
              village_id: data.demo.village_id, village_name: data.demo.village_name,
              block_name: data.demo.block_name, district_name: data.demo.district_name,
              state_name: data.demo.state_name, country_name: data.demo.country_name,
            });
            setEditingTfoDemo(data);
            setDemoFormOrigin('tfo-demo-detail');
            setScreen('create-tfo-demo');
          }}
        />
      )}
      {screen === 'tfo-homegardens-list' && (
        <HomeGardensListScreen
          token={token}
          onBack={() => setScreen('home')}
          onCreateNew={() => {
            setHomeGardenFormOrigin('tfo-select-farmer-for-homegarden');
            setScreen('tfo-select-farmer-for-homegarden');
          }}
        />
      )}
      {screen === 'tfo-select-farmer-for-homegarden' && (
        <FarmersListScreen
          token={token}
          title="Select Farmer — Home Garden"
          onBack={() => setScreen('tfo-homegardens-list')}
          onSelectFarmer={(farmer) => {
            setSelectedFarmerForHomeGarden(farmer);
            setScreen('create-tfo-homegarden');
          }}
        />
      )}
      {screen === 'create-tfo-homegarden' && selectedFarmerForHomeGarden && (
        <CreateHomeGardenScreen
          token={token}
          farmer={selectedFarmerForHomeGarden}
          onBack={() => setScreen(homeGardenFormOrigin)}
          onCreated={() => {
            const returnTo = homeGardenFormOrigin === 'tfo-select-farmer-for-homegarden' ? 'tfo-homegardens-list' : homeGardenFormOrigin;
            setSelectedFarmerForHomeGarden(null);
            setScreen(returnTo);
          }}
        />
      )}
      {screen === 'data-collection' && (
        <DataCollectionFormsListScreen
          token={token}
          onBack={() => setScreen('home')}
          onSelectForm={(form) => {
            setSelectedDataCollectionForm(form);
            setScreen('select-farmer-for-form');
          }}
        />
      )}
      {screen === 'select-farmer-for-form' && (
        <FarmersListScreen
          token={token}
          title="Select Farmer"
          onBack={() => setScreen('data-collection')}
          onSelectFarmer={(farmer) => {
            setSelectedFarmerForDataCollection(farmer);
            setScreen('fill-data-collection-form');
          }}
        />
      )}
      {screen === 'fill-data-collection-form' && selectedDataCollectionForm && selectedFarmerForDataCollection && (
        <FillDataCollectionFormScreen
          token={token}
          form={selectedDataCollectionForm}
          farmer={selectedFarmerForDataCollection}
          onBack={() => setScreen('select-farmer-for-form')}
          onSubmitted={() => {
            setSelectedFarmerForDataCollection(null);
            setScreen('data-collection');
          }}
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
          onCreateNew={user.role === 'data_enumerator' ? undefined : () => setScreen('create-farmer')}
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
          onCreateDemo={() => {
            setSelectedFarmerForTfoDemo(selectedFarmer);
            setEditingTfoDemo(null);
            setDemoFormOrigin('farmer-detail');
            setScreen('create-tfo-demo');
          }}
          onCreateHomeGarden={() => {
            setSelectedFarmerForHomeGarden(selectedFarmer);
            setHomeGardenFormOrigin('farmer-detail');
            setScreen('create-tfo-homegarden');
          }}
          onSelectDemo={(demoId) => {
            setSelectedTfoDemoId(demoId);
            setDemoDetailOrigin('farmer-detail');
            setScreen('tfo-demo-detail');
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
