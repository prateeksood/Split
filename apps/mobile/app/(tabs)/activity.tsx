import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatRelativeTime } from '@split/shared';
import { useTheme } from '../../theme/ThemeProvider';
import { api, type ActivityFeedItem } from '../../services/api';
import { ScreenHeader, EmptyState, Chip, AppTextInput } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant',
  Transport: 'car',
  Accommodation: 'bed',
  Entertainment: 'game-controller',
  Utilities: 'flash',
  Shopping: 'cart',
  Health: 'medical',
  Other: 'pricetag',
};

type TypeFilter = 'all' | 'expense' | 'settlement' | 'member';

export default function ActivityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.accessToken); // just to trigger re-render; profile from query below
  const { data: profileData } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });

  const handleTap = (item: ActivityFeedItem) => {
    if (item.kind === 'expense' && item.groupId) {
      router.push({ pathname: '/group/[id]', params: { id: item.groupId } });
    } else if (item.kind === 'settlement' && item.groupId) {
      router.push({ pathname: '/group/[id]', params: { id: item.groupId } });
    } else if ((item.kind === 'member' || item.kind === 'settlement') && item.groupId) {
      router.push({ pathname: '/group/[id]', params: { id: item.groupId } });
    }
  };

  const voidSettlement = useMutation({
    mutationFn: (id: string) => api.settlements.void(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api.groups.list() });

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['activity', q, typeFilter, groupId],
    queryFn: ({ pageParam }) => api.activity.feed({ q, type: typeFilter, groupId, page: pageParam, limit: 20 }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Activity" large />

      <View style={styles.controls}>
        <AppTextInput
          icon="search-outline"
          placeholder="Search expenses, people, notes…"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'all', label: 'All' },
            { key: 'expense', label: 'Expenses' },
            { key: 'settlement', label: 'Settlements' },
            { key: 'member', label: 'Members' },
          ] as const}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Chip label={item.label} selected={typeFilter === item.key} onPress={() => setTypeFilter(item.key)} />
          )}
        />
        {groups && groups.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: undefined, name: 'All groups' }, ...groups.map((g) => ({ id: g.id, name: g.name }))]}
            keyExtractor={(item) => item.id ?? 'all'}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            renderItem={({ item }) => (
              <Chip label={item.name} selected={groupId === item.id} onPress={() => setGroupId(item.id)} />
            )}
          />
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 110, flexGrow: 1 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        renderItem={({ item }) => (
          <ActivityRow
            item={item}
            theme={theme}
            currentUserId={profileData?.id}
            onTap={item.groupId ? () => handleTap(item) : undefined}
            onVoidSettlement={
              item.kind === 'settlement' && item.userPaid
                ? () => {
                    const doVoid = () => voidSettlement.mutate(item.sourceId);
                    if (Platform.OS === 'web') {
                      if (window.confirm('Void this settlement? This cannot be undone.')) doVoid();
                    } else {
                      Alert.alert('Void settlement?', 'This payment record will be deleted. This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Void', style: 'destructive', onPress: doVoid },
                      ]);
                    }
                  }
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.colors.accent.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              icon="time-outline"
              title={q || typeFilter !== 'all' || groupId ? 'No matching activity' : "You're all caught up"}
              message={
                q || typeFilter !== 'all' || groupId
                  ? 'Try a different search or filter.'
                  : 'Expenses and settlements across your groups will appear here.'
              }
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={theme.colors.accent.primary} style={{ marginVertical: 16 }} /> : null
        }
      />
    </View>
  );
}

function ActivityRow({
  item,
  theme,
  currentUserId: _currentUserId,
  onTap,
  onVoidSettlement,
}: {
  item: ActivityFeedItem;
  theme: ReturnType<typeof useTheme>;
  currentUserId?: string;
  onTap?: () => void;
  onVoidSettlement?: () => void;
}) {
  const isSettlement = item.kind === 'settlement';
  const isMember = item.kind === 'member';
  const isDeleted = item.action === 'deleted';
  const isUpdated = item.action === 'updated';

  let icon: keyof typeof Ionicons.glyphMap = CATEGORY_ICONS[item.category ?? 'Other'] ?? 'pricetag';
  let accent: string = theme.colors.accent.primary;
  if (isSettlement) {
    icon = 'swap-horizontal';
    accent = theme.colors.accent.success;
  } else if (isMember) {
    icon = item.subtitle === 'Group created' ? 'sparkles' : 'person-add';
    accent = theme.colors.accent.secondary;
  } else if (isDeleted) {
    icon = 'trash-outline';
    accent = theme.colors.accent.danger;
  } else if (isUpdated) {
    icon = 'create-outline';
    accent = theme.colors.accent.secondary;
  }

  const shareColor = item.userPaid ? theme.colors.accent.success : theme.colors.accent.danger;
  const shareLabel = isSettlement
    ? `${item.userPaid ? '-' : '+'}${formatCurrency(item.amount, item.currency)}`
    : item.userPaid
      ? `+${formatCurrency(item.amount - item.userShare, item.currency)}`
      : `-${formatCurrency(item.userShare, item.currency)}`;

  return (
    <Pressable
      onPress={onTap}
      disabled={!onTap}
      style={({ pressed }) => [styles.item, theme.shadows.sm, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium, flex: 1 }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.action && item.action !== 'created' ? (
              <View style={[styles.actionBadge, { backgroundColor: (isDeleted ? theme.colors.accent.danger : theme.colors.accent.secondary) + '22' }]}>
                <Text style={{ fontSize: 10, color: isDeleted ? theme.colors.accent.danger : theme.colors.accent.secondary, fontFamily: theme.typography.fontFamily.medium, textTransform: 'capitalize' }}>
                  {item.action}
                </Text>
              </View>
            ) : null}
          </View>
          {!isMember ? (
            <Text style={[styles.amount, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display, opacity: isDeleted ? 0.55 : 1 }]}>
              {formatCurrency(item.amount, item.currency)}
            </Text>
          ) : null}
        </View>
        <View style={styles.row}>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
          {!isMember ? (
            <Text style={[styles.share, { color: shareColor, fontFamily: theme.typography.fontFamily.medium }]}>{shareLabel}</Text>
          ) : null}
        </View>
        {item.diff && Object.keys(item.diff).length > 0 ? (
          <View style={styles.diffWrap}>
            {Object.entries(item.diff).map(([field, [from, to]]) => (
              <Text key={field} style={[styles.diffLine, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body }]} numberOfLines={1}>
                {field}: {String(from)} → {String(to)}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={[styles.row, { alignItems: 'center' }]}>
          <Text style={[styles.time, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
            {formatRelativeTime(item.date)}
          </Text>
          {onVoidSettlement ? (
            <Pressable onPress={onVoidSettlement} hitSlop={8}>
              <Text style={{ color: theme.colors.accent.danger, fontSize: 11, fontFamily: theme.typography.fontFamily.medium }}>
                Void
              </Text>
            </Pressable>
          ) : null}
          {onTap && !isMember ? (
            <Ionicons name="chevron-forward" size={12} color={theme.colors.text.tertiary} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, flex: 1 },
  amount: { fontSize: 15 },
  subtitle: { fontSize: 12.5, flex: 1 },
  share: { fontSize: 12.5 },
  time: { fontSize: 11, marginTop: 3 },
  actionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  diffWrap: { marginTop: 4, gap: 1 },
  diffLine: { fontSize: 11 },
});
