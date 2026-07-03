import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../../services/api';
import { pickContactWithEmail } from '../../services/contacts';
import { shareInviteLink, sendSmsInvite, inviteContactBySms } from '../../services/invite';
import { SkeletonFriendCard } from '../../components/Skeleton';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ScreenHeader, HeaderIconButton, EmptyState, Avatar, noOutline } from '../../components/ui';

export default function FriendsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });

  const { data: friends, isLoading, error: listError, refetch, isRefetching } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.friends.list(),
  });

  const handleAdd = async () => {
    if (!email.trim()) return;
    setAdding(true);
    setError('');
    try {
      await api.friends.add(email.trim());
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const handlePickContact = async () => {
    setError('');
    try {
      const contact = await pickContactWithEmail();
      if (!contact) return;
      if (contact.email) {
        setEmail(contact.email);
        return;
      }
      if (contact.phone) {
        const { message } = await api.friends.inviteLink();
        await inviteContactBySms(contact.phone, message);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const handleInviteShare = async () => {
    setError('');
    try {
      await shareInviteLink();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const handleInviteSms = async () => {
    setError('');
    try {
      await sendSmsInvite();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const displayError = error || (listError ? getApiErrorMessage(listError) : '');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title="Friends"
        large
        right={
          <>
            <HeaderIconButton icon="chatbubble-outline" onPress={handleInviteSms} color={theme.colors.accent.primary} />
            <HeaderIconButton icon="share-outline" onPress={handleInviteShare} color={theme.colors.accent.primary} />
          </>
        }
      />

      {displayError ? (
        <ErrorBanner message={displayError} onDismiss={() => { setError(''); refetch(); }} />
      ) : null}

      <View style={styles.addRow}>
        <Pressable style={[styles.contactBtn, { backgroundColor: theme.colors.accent.muted }]} onPress={handlePickContact}>
          <Ionicons name="people-outline" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <TextInput
          style={[styles.input, noOutline, { backgroundColor: theme.colors.background.secondary, color: theme.colors.text.primary, borderColor: theme.colors.border.hairline, fontFamily: theme.typography.fontFamily.body }]}
          placeholder="Add friend by email"
          placeholderTextColor={theme.colors.text.tertiary}
          value={email}
          onChangeText={(v) => { setEmail(v); if (error) setError(''); }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Pressable style={[styles.addBtn, theme.shadows.sm, { backgroundColor: theme.colors.accent.primary }]} onPress={handleAdd} disabled={adding}>
          {adding ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="person-add" size={20} color="#FFF" />}
        </Pressable>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 110, flexGrow: 1 }}
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <SkeletonFriendCard key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="person-add-outline"
              title="No friends yet"
              message="Add friends by email or invite them via SMS to track who owes whom across all your groups."
              ctaLabel="Invite via SMS"
              onCta={handleInviteSms}
            />
          )
        }
        renderItem={({ item }) => {
          const isOwed = item.balance >= 0;
          const isSettled = Math.abs(item.balance) < 0.01;
          return (
            <View style={[styles.card, theme.shadows.sm, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}>
              <Avatar name={item.name} size={46} />
              <View style={styles.cardContent}>
                <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.colors.text.secondary, fontSize: 13, fontFamily: theme.typography.fontFamily.body }} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <View style={styles.balanceCol}>
                <Text style={{ color: isSettled ? theme.colors.text.secondary : isOwed ? theme.colors.accent.success : theme.colors.accent.danger, fontFamily: theme.typography.fontFamily.display, fontSize: 16 }}>
                  {formatCurrency(Math.abs(item.balance), profile?.defaultCurrency ?? 'USD')}
                </Text>
                <Text style={{ color: theme.colors.text.tertiary, fontSize: 11, marginTop: 3, fontFamily: theme.typography.fontFamily.body }}>
                  {isSettled ? 'settled' : isOwed ? 'owes you' : 'you owe'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 8, marginTop: 4, alignItems: 'center' },
  contactBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  addBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  cardContent: { flex: 1, marginLeft: 14 },
  name: { fontSize: 16 },
  balanceCol: { alignItems: 'flex-end', marginLeft: 8 },
});
