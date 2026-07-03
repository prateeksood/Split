import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 * On web: uses window.confirm (Alert.alert is a no-op).
 * On native: uses Alert.alert.
 */
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  destructive = true,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: destructive ? 'Delete' : 'OK', style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function alertError(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    return;
  }
  Alert.alert(title, message);
}
