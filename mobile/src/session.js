import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'session';

export const saveSession = (session) => AsyncStorage.setItem(KEY, JSON.stringify(session));
export const clearSession = () => AsyncStorage.removeItem(KEY);
export const loadSession = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};

// The active Project for a TFO working on more than one - stored in the
// same session blob (not a separate mechanism) so it naturally survives
// an app restart but is gone the moment clearSession() runs at logout,
// matching "remains active until logout".
export const saveActiveProjectId = async (activeProjectId) => {
  const session = await loadSession();
  if (!session) return;
  await saveSession({ ...session, activeProjectId });
};

// Per-device mute switch, deliberately separate from the session blob - it
// should survive a logout/login on the same phone rather than reset with it.
const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';

export const areNotificationsEnabled = async () => {
  const raw = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return raw === null ? true : raw === 'true';
};
export const setNotificationsEnabled = (enabled) =>
  AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
