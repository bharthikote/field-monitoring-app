import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function explainDenied(what, canAskAgain) {
  const buttons = [{ text: 'OK', style: 'cancel' }];
  if (canAskAgain === false) buttons.unshift({ text: 'Open Settings', onPress: () => Linking.openSettings() });
  Alert.alert(
    `${what} access is off`,
    canAskAgain === false
      ? `Allow ${what.toLowerCase()} access for this app in your phone settings, then try again.`
      : `This app needs ${what.toLowerCase()} access to add a photo.`,
    buttons,
  );
}

async function takePhoto() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    explainDenied('Camera', perm.canAskAgain);
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  return result.canceled ? null : result.assets[0];
}

async function chooseFromGallery() {
  // The Android system photo picker needs no permission; asking for media
  // access first can only block it, so a "no" here is not a reason to stop.
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.canAskAgain === false) {
    explainDenied('Photo', false);
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
  return result.canceled ? null : result.assets[0];
}

// Take-or-choose photo flow shared by every screen that captures a photo
// (Log Visit, Training, ...). Always resolves - to the picked asset, or null
// if cancelled or it failed - and tells the user why when it failed, since
// the caller has no other way to show it.
export async function pickPhoto() {
  return new Promise((resolve) => {
    const run = (action, failTitle) => async () => {
      try {
        resolve(await action());
      } catch (err) {
        Alert.alert(failTitle, err?.message || 'Something went wrong. Please try again.');
        resolve(null);
      }
    };
    Alert.alert(
      'Add Photo',
      'Choose a source',
      [
        { text: 'Take Photo', onPress: run(takePhoto, 'Could not open the camera') },
        { text: 'Choose from Gallery', onPress: run(chooseFromGallery, 'Could not open the gallery') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export function assetToFormFile(asset) {
  const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
  const type = asset.mimeType || 'image/jpeg';
  return { uri: asset.uri, name, type };
}
