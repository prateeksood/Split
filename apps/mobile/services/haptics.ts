import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function impactLight() {
  if (!isNative) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function notifySuccess() {
  if (!isNative) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
