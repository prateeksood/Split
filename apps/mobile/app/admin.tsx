import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { adminApi, type AdminUser } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { SectionHeader, EmptyState, Chip } from '../components/ui';

type Tab = 'overview' | 'users' | 'logs';

type UserStatusFilter = 'all' | 'active' | 'deactivated';

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [userStatus, setUserStatus] = useState<UserStatusFilter>('all');
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats(),
    retry: 1,
  });

  const { data: aiStats } = useQuery({
    queryKey: ['admin', 'ai-stats'],
    queryFn: () => adminApi.aiStats(),
    retry: 1,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', userPage, search, userStatus],
    queryFn: () => adminApi.listUsers(userPage, 20, search || undefined, userStatus),
    enabled: tab === 'users',
  });

  const { data: signups } = useQuery({
    queryKey: ['admin', 'signups'],
    queryFn: () => adminApi.recentSignups(30),
    enabled: tab === 'logs',
  });

  const [actionMsg, setActionMsg] = useState('');

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionMsg('User deactivated.');
    },
    onError: (e: unknown) => setActionMsg(`Error: ${e instanceof Error ? e.message : 'Failed'}`),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => adminApi.reactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionMsg('User reactivated.');
    },
    onError: (e: unknown) => setActionMsg(`Error: ${e instanceof Error ? e.message : 'Failed'}`),
  });

  const sendVerification = useMutation({
    mutationFn: (id: string) => adminApi.sendVerification(id),
    onSuccess: (data: { message: string }) => setActionMsg(data.message),
    onError: (e: unknown) => setActionMsg(`Error: ${e instanceof Error ? e.message : 'Failed'}`),
  });

  const purgeUser = useMutation({
    mutationFn: (id: string) => adminApi.purgeUser(id),
    onSuccess: (data: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionMsg(data.message);
    },
    onError: (e: unknown) => setActionMsg(`Error: ${e instanceof Error ? e.message : 'Failed'}`),
  });

  const confirmPurge = (user: AdminUser) => {
    const msg =
      `Permanently delete ${user.name} (${user.email})?\n\n` +
      'Their email will be freed for a new registration. Past expenses in groups will show as "Deleted User". This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) purgeUser.mutate(user.id);
    } else {
      Alert.alert('Delete account permanently?', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => purgeUser.mutate(user.id) },
      ]);
    }
  };

  const confirmDeactivate = (user: AdminUser) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Deactivate ${user.name} (${user.email})?`)) deactivate.mutate(user.id);
    } else {
      Alert.alert('Deactivate user', `Deactivate ${user.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => deactivate.mutate(user.id) },
      ]);
    }
  };

  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.background.primary, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border.hairline }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: c.accent.danger }]}>
            <Ionicons name="shield-checkmark" size={16} color="#fff" />
          </View>
          <Text style={[styles.title, { color: c.text.primary, fontFamily: theme.typography.fontFamily.display }]}>
            Admin
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
          Platform dashboard
        </Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabs, { borderBottomColor: c.border.hairline, backgroundColor: c.background.secondary }]}>
        {(['overview', 'users', 'logs'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && { borderBottomColor: c.accent.primary, borderBottomWidth: 2 }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, { color: tab === t ? c.accent.primary : c.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* ── Overview ── */}
        {tab === 'overview' && (
          <View>
            {statsLoading ? (
              <ActivityIndicator color={c.accent.primary} style={{ marginTop: 40 }} />
            ) : stats ? (
              <>
                <SectionHeader title="Users" />
                <View style={styles.grid}>
                  <StatCard label="Total" value={stats.users.total} icon="people" color={c.accent.primary} theme={theme} />
                  <StatCard label="Verified" value={stats.users.verified} icon="checkmark-circle" color={c.accent.success} theme={theme} />
                  <StatCard label="Unverified" value={stats.users.unverified} icon="mail-unread" color={c.accent.warning} theme={theme} />
                  <StatCard label="Today" value={stats.users.newToday} icon="person-add" color={c.accent.secondary} theme={theme} />
                  <StatCard label="This Week" value={stats.users.newThisWeek} icon="trending-up" color={c.accent.secondary} theme={theme} />
                  <StatCard label="This Month" value={stats.users.newThisMonth} icon="calendar" color={c.accent.secondary} theme={theme} />
                </View>

                <SectionHeader title="Content" />
                <View style={styles.grid}>
                  <StatCard label="Groups" value={stats.groups.total} icon="people-circle" color={c.accent.primary} theme={theme} />
                  <StatCard label="Expenses" value={stats.expenses.total} icon="receipt" color={c.accent.warning} theme={theme} />
                  <StatCard label="Settlements" value={stats.settlements.total} icon="swap-horizontal" color={c.accent.success} theme={theme} />
                  <StatCard label="Total Amount" value={`₹${stats.expenses.totalAmount.toLocaleString()}`} icon="cash" color={c.accent.primary} theme={theme} />
                </View>
              </>
            ) : (
              <EmptyState icon="alert-circle-outline" title="Could not load stats" message="Check ADMIN_EMAILS env var is set and you are logged in as an admin." />
            )}

            {aiStats && (
              <>
                <SectionHeader title="AI Usage" />
                <View style={styles.grid}>
                  <StatCard label="Total Parses" value={aiStats.total} icon="sparkles" color={c.accent.primary} theme={theme} />
                  <StatCard label="Last 24h" value={aiStats.last24h} icon="time" color={c.accent.secondary} theme={theme} />
                  {aiStats.byProvider.map((p) => (
                    <StatCard key={p.provider} label={p.provider} value={p.count} icon="cloud" color={c.accent.secondary} theme={theme} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <View>
            {actionMsg ? (
              <Pressable onPress={() => setActionMsg('')} style={[styles.actionMsg, { backgroundColor: c.accent.success + '22' }]}>
                <Text style={{ color: c.accent.success, fontFamily: theme.typography.fontFamily.medium, fontSize: 13 }}>{actionMsg} (tap to dismiss)</Text>
              </Pressable>
            ) : null}
            <View style={[styles.searchRow, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]}>
              <Ionicons name="search" size={16} color={c.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: c.text.primary, fontFamily: theme.typography.fontFamily.body }]}
                placeholder="Search by name or email…"
                placeholderTextColor={c.text.tertiary}
                value={search}
                onChangeText={(v) => { setSearch(v); setUserPage(0); }}
              />
              {search ? (
                <Pressable onPress={() => { setSearch(''); setUserPage(0); }}>
                  <Ionicons name="close-circle" size={16} color={c.text.tertiary} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.statusRow}>
              {([
                { key: 'all' as const, label: 'All' },
                { key: 'active' as const, label: 'Active' },
                { key: 'deactivated' as const, label: 'Deactivated' },
              ]).map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={userStatus === opt.key}
                  onPress={() => { setUserStatus(opt.key); setUserPage(0); }}
                />
              ))}
            </View>

            {usersLoading ? (
              <ActivityIndicator color={c.accent.primary} style={{ marginTop: 40 }} />
            ) : (
              <>
                <Text style={[styles.count, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
                  {usersData?.total ?? 0} users
                </Text>
                {usersData?.users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    theme={theme}
                    onDeactivate={() => confirmDeactivate(user)}
                    onReactivate={() => reactivate.mutate(user.id)}
                    onSendVerification={() => sendVerification.mutate(user.id)}
                    onPurge={() => confirmPurge(user)}
                    isPurged={user.email.endsWith('@deleted.local')}
                    isDeactivated={!!user.deletedAt}
                  />
                ))}

                {/* Pagination */}
                <View style={styles.pagination}>
                  <Pressable
                    disabled={userPage === 0}
                    onPress={() => setUserPage((p) => p - 1)}
                    style={[styles.pageBtn, { backgroundColor: c.background.secondary, opacity: userPage === 0 ? 0.4 : 1 }]}
                  >
                    <Ionicons name="chevron-back" size={18} color={c.text.primary} />
                  </Pressable>
                  <Text style={{ color: c.text.secondary, fontFamily: theme.typography.fontFamily.body }}>
                    Page {userPage + 1}
                  </Text>
                  <Pressable
                    disabled={!usersData?.hasMore}
                    onPress={() => setUserPage((p) => p + 1)}
                    style={[styles.pageBtn, { backgroundColor: c.background.secondary, opacity: !usersData?.hasMore ? 0.4 : 1 }]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={c.text.primary} />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Logs ── */}
        {tab === 'logs' && (
          <View>
            <SectionHeader title="Recent Signups" />
            {(signups ?? []).map((u) => (
              <View key={u.id} style={[styles.logRow, { borderBottomColor: c.border.hairline }]}>
                <View style={[styles.dot, { backgroundColor: u.emailVerified ? c.accent.success : c.accent.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logName, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{u.name}</Text>
                  <Text style={[styles.logEmail, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>{u.email}</Text>
                </View>
                <Text style={[styles.logDate, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color, theme }: { label: string; value: number | string; icon: keyof typeof Ionicons.glyphMap; color: string; theme: ReturnType<typeof useTheme> }) {
  const c = theme.colors;
  return (
    <View style={[styles.card, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.cardValue, { color: c.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{value}</Text>
      <Text style={[styles.cardLabel, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>{label}</Text>
    </View>
  );
}

function UserRow({ user, theme, onDeactivate, onReactivate, onSendVerification, onPurge, isPurged, isDeactivated }: {
  user: AdminUser;
  theme: ReturnType<typeof useTheme>;
  onDeactivate: () => void;
  onReactivate: () => void;
  onSendVerification: () => void;
  onPurge: () => void;
  isPurged?: boolean;
  isDeactivated?: boolean;
}) {
  const c = theme.colors;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.userCard, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]}>
      <Pressable style={styles.userHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.userAvatar, { backgroundColor: c.accent.muted }]}>
          <Text style={[styles.userAvatarText, { color: c.accent.primary }]}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>{user.email}</Text>
        </View>
        <View style={[styles.verifiedBadge, { backgroundColor: isDeactivated ? c.accent.danger + '22' : user.emailVerified ? c.accent.success + '22' : c.accent.warning + '22' }]}>
          <Text style={[styles.verifiedText, { color: isDeactivated ? c.accent.danger : user.emailVerified ? c.accent.success : c.accent.warning }]}>
            {isDeactivated ? 'Deactivated' : user.emailVerified ? 'Verified' : 'Unverified'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={[styles.userActions, { borderTopColor: c.border.hairline }]}>
          <Text style={[styles.userMeta, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
            Joined {new Date(user.createdAt).toLocaleDateString()} · {user.googleId ? 'Google' : 'Email'} auth
          </Text>
          <View style={styles.actionRow}>
            {!isPurged && !isDeactivated && !user.emailVerified && (
              <ActionBtn label="Send verification" icon="mail" color={c.accent.primary} onPress={onSendVerification} theme={theme} />
            )}
            {!isPurged && isDeactivated && (
              <ActionBtn label="Reactivate" icon="checkmark-circle" color={c.accent.success} onPress={onReactivate} theme={theme} />
            )}
            {!isPurged && !isDeactivated && (
              <>
                <ActionBtn label="Deactivate" icon="ban" color={c.accent.danger} onPress={onDeactivate} theme={theme} />
                <ActionBtn label="Delete permanently" icon="trash" color={c.accent.danger} onPress={onPurge} theme={theme} />
              </>
            )}
            {!isPurged && isDeactivated && (
              <ActionBtn label="Delete permanently" icon="trash" color={c.accent.danger} onPress={onPurge} theme={theme} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function ActionBtn({ label, icon, color, onPress, theme }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable style={[styles.actionBtn, { borderColor: color }]} onPress={onPress}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.actionBtnText, { color, fontFamily: theme.typography.fontFamily.medium }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22 },
  subtitle: { fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14 },
  body: { flex: 1, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  card: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 6, alignItems: 'center' },
  cardValue: { fontSize: 22, marginTop: 2 },
  cardLabel: { fontSize: 12 },
  actionMsg: { borderRadius: 10, padding: 12, marginTop: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 12 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  count: { fontSize: 13, marginBottom: 8 },
  userCard: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 14 },
  userEmail: { fontSize: 12, marginTop: 1 },
  verifiedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  verifiedText: { fontSize: 11, fontWeight: '600' },
  userActions: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  userMeta: { fontSize: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logName: { fontSize: 14 },
  logEmail: { fontSize: 12, marginTop: 1 },
  logDate: { fontSize: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 16 },
  pageBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
