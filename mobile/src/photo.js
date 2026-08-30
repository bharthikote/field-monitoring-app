import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Take-or-choose photo flow shared by every screen that captures a photo
// (Log Visit, Training, ...).
export async function pickPhoto() {
  return new Promise((resolve) => {
    Alert.alert('Add Photo', 'Choose a source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return resolve(null);
          const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
          resolve(result.canceled ? null : result.assets[0]);
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return resolve(null);
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
          resolve(result.canceled ? null : result.assets[0]);
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export function assetToFormFile(asset) {
  const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
  const type = asset.mimeType || 'image/jpeg';
  return { uri: asset.uri, name, type };
}
