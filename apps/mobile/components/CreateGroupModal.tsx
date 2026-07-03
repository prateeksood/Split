import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GROUP_CATEGORIES } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../services/api';
import { pickContactWithEmail } from '../services/contacts';
import { AppButton, AppTextInput, Chip } from './ui';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGroupModal({ visible, onClose, onCreated }: CreateGroupModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof GROUP_CATEGORIES)[number]>('Other');
  const [memberEmails, setMemberEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.groups.create({
        name: name.trim(),
        category,
        memberEmails: memberEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      });
      setName('');
      setMemberEmails('');
      onCreated();
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background.elevated }]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.hairline }]} />
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Create Group</Text>

          <AppTextInput
            label="Group name"
            icon="people-outline"
            placeholder="e.g. Goa Trip"
            value={name}
            onChangeText={setName}
            containerStyle={{ marginBottom: 14 }}
          />

          <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={styles.categories}>
            {GROUP_CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>

          <AppTextInput
            label="Members (optional)"
            icon="mail-outline"
            placeholder="Emails, comma-separated"
            value={memberEmails}
            onChangeText={setMemberEmails}
            autoCapitalize="none"
            rightSlot={
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  const contact = await pickContactWithEmail();
                  if (contact?.email) {
                    setMemberEmails((prev) => (prev ? `${prev}, ${contact.email}` : contact.email!));
                  }
                }}
              >
                <Ionicons name="person-add-outline" size={20} color={theme.colors.accent.primary} />
              </Pressable>
            }
          />

          {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

          <AppButton label="Create Group" icon="add" size="lg" loading={loading} onPress={handleCreate} fullWidth style={{ marginTop: 20 }} />
          <AppButton label="Cancel" variant="ghost" onPress={onClose} fullWidth style={{ marginTop: 6 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 10 },
  categories: { marginBottom: 14 },
});
