import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage, type GroupMember } from '../services/api';
import { confirm } from '../utils/confirm';
import { CurrencyPicker } from './CurrencyPicker';
import { AppButton, AppTextInput } from './ui';

interface EditGroupModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  groupCurrency: string;
  members: GroupMember[];
  onClose: () => void;
  onUpdated: () => void;
  onArchived?: () => void;
}

export function EditGroupModal({
  visible,
  groupId,
  groupName,
  groupCurrency,
  members,
  onClose,
  onUpdated,
  onArchived,
}: EditGroupModalProps) {
  const theme = useTheme();
  const [name, setName] = useState(groupName);
  const [currency, setCurrency] = useState(groupCurrency);
  const [nameLoading, setNameLoading] = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me(), enabled: visible });

  const memberId = (m: GroupMember) => m.userId ?? m.user.id;
  const isCurrentUserAdmin = members.some((m) => memberId(m) === profile?.id && m.role === 'admin');

  useEffect(() => {
    setName(groupName);
    setCurrency(groupCurrency);
  }, [groupName, groupCurrency, visible]);

  const handleNameSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === groupName) return;
    setNameLoading(true);
    setError('');
    try {
      await api.groups.update(groupId, { name: trimmed });
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e));
      setName(groupName);
    } finally {
      setNameLoading(false);
    }
  };

  const handleCurrencyChange = async (next: string) => {
    if (next === currency) return;
    setCurrencyLoading(true);
    setError('');
    try {
      await api.groups.update(groupId, { currency: next });
      setCurrency(next);
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setCurrencyLoading(false);
    }
  };

  const handleArchive = () => {
    confirm(
      'Delete group?',
      `"${groupName}" will be hidden from your list. Expenses and history are kept for audit purposes.`,
      async () => {
        setArchiving(true);
        setError('');
        try {
          await api.groups.archive(groupId);
          onArchived?.();
        } catch (e) {
          setError(getApiErrorMessage(e));
        } finally {
          setArchiving(false);
        }
      },
    );
  };

  const nameChanged = name.trim() !== groupName && name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background.elevated }]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.hairline }]} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>
              Edit Group
            </Text>

            {isCurrentUserAdmin ? (
              <>
                <AppTextInput
                  label="Group name"
                  icon="people-outline"
                  placeholder="Group name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleNameSave}
                />
                {nameChanged ? (
                  <AppButton
                    label="Save name"
                    icon="checkmark-outline"
                    variant="secondary"
                    loading={nameLoading}
                    onPress={handleNameSave}
                    fullWidth
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </>
            ) : (
              <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body, marginBottom: 8 }]}>
                {groupName}
              </Text>
            )}

            {isCurrentUserAdmin ? (
              <>
                <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Group currency</Text>
                <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
                  All expenses in this group use this currency. Changing it updates existing expenses too.
                </Text>
                {currencyLoading ? (
                  <ActivityIndicator color={theme.colors.accent.primary} style={{ marginBottom: 12 }} />
                ) : (
                  <CurrencyPicker value={currency} onChange={handleCurrencyChange} label="" />
                )}
              </>
            ) : (
              <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body, marginTop: 8 }]}>
                Only group admins can edit the name and currency.
              </Text>
            )}

            {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

            <AppButton label="Done" size="lg" onPress={onClose} fullWidth style={{ marginTop: 20 }} />
            {isCurrentUserAdmin ? (
              <AppButton label="Delete group" icon="trash-outline" variant="danger" loading={archiving} onPress={handleArchive} fullWidth style={{ marginTop: 10 }} />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '88%' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, marginBottom: 16 },
  subtitle: { fontSize: 15 },
  label: { fontSize: 13, marginBottom: 8, marginTop: 16 },
  hint: { fontSize: 12.5, marginBottom: 12, lineHeight: 18 },
});
