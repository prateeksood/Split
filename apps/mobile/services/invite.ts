import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from './api';

export async function shareInviteLink(): Promise<void> {
  const { message } = await api.friends.inviteLink();
  await Share.share({ message, title: 'Invite to Split' });
}

export async function sendSmsInvite(): Promise<void> {
  const { message, smsUrl } = await api.friends.inviteLink();

  if (Platform.OS === 'web') {
    await Share.share({ message });
    return;
  }

  const canOpen = await Linking.canOpenURL(smsUrl);
  if (canOpen) {
    await Linking.openURL(smsUrl);
  } else {
    await Share.share({ message });
  }
}

export async function inviteContactBySms(phone: string, message: string): Promise<void> {
  const body = encodeURIComponent(message);
  const url = Platform.select({
    ios: `sms:${phone}&body=${body}`,
    android: `sms:${phone}?body=${body}`,
    default: `sms:?body=${body}`,
  });

  if (url && (await Linking.canOpenURL(url))) {
    await Linking.openURL(url);
  }
}

export async function shareGroupInvite(groupId: string): Promise<void> {
  const { message } = await api.groups.getInvite(groupId);
  await Share.share({ message, title: 'Join my group on Split' });
}

export async function copyGroupInviteCode(groupId: string): Promise<string> {
  const { inviteCode } = await api.groups.getInvite(groupId);
  await Clipboard.setStringAsync(inviteCode);
  return inviteCode;
}

export async function copyGroupInviteLink(groupId: string): Promise<string> {
  const { link } = await api.groups.getInvite(groupId);
  await Clipboard.setStringAsync(link);
  return link;
}
