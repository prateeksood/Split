import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSecureItem, setSecureItem, deleteSecureItem } from './secureStorage';

const BIOMETRIC_KEY = 'split_biometric_enabled';

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await getSecureItem(BIOMETRIC_KEY)) === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) await setSecureItem(BIOMETRIC_KEY, 'true');
  else await deleteSecureItem(BIOMETRIC_KEY);
}

export async function authenticateWithBiometric(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Split',
    fallbackLabel: 'Use password',
  });
  return result.success;
}
