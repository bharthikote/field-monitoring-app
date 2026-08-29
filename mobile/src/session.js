import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'session';

export const saveSession = (session) => AsyncStorage.setItem(KEY, JSON.stringify(session));
export const clearSession = () => AsyncStorage.removeItem(KEY);
export const loadSession = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};
