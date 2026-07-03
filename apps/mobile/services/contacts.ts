import { Platform, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';

export interface PickedContact {
  name: string;
  email?: string;
  phone?: string;
}

export async function pickContactWithEmail(): Promise<PickedContact | null> {
  if (Platform.OS === 'web') {
    Alert.alert('Contacts', 'Contact picker is available on iOS and Android.');
    return null;
  }

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission required', 'Allow contacts access to pick a friend.');
    return null;
  }

  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null;

  const name = contact.name ?? 'Contact';
  const email = contact.emails?.[0]?.email;
  const phone = contact.phoneNumbers?.[0]?.number;

  if (!email && !phone) {
    Alert.alert('No contact info', 'Selected contact has no email or phone number.');
    return null;
  }

  return { name, email, phone };
}
