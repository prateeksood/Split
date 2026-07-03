import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelativeTime } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, type NotificationItem } from '../services/api';
import { ScreenHeader, EmptyState } from '../components/ui';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, refetch, isRefetching, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => api.notifications.list(pageParam, 20),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const notifications = data?.pages.flatMap((p) => p.items) ?? [];

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
  };

  const handleOpen = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await api.notifications.markRead(item.id);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      } catch {
        /* non-blocking */
      }
    }
    const groupId = item.data?.groupId;
    if (typeof groupId === 'string') {
      router.push({ pathname: '/group/[id]', params: { id: groupId } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={{ color: theme.colors.accent.primary, fontSize: 14, fontFamily: theme.typography.fontFamily.medium }}>Read all</Text>
          </Pressable>
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={theme.colors.accent.primary} style={{ marginVertical: 16 }} /> : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.colors.accent.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState icon="notifications-outline" title="No notifications yet" message="Updates about expenses, settlements, and group activity will appear here." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleOpen(item)}
            style={({ pressed }) => [
              styles.item,
              theme.shadows.sm,
              {
                backgroundColor: theme.colors.background.secondary,
                borderColor: item.read ? theme.colors.border.hairline : theme.colors.accent.primary,
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            {!item.read ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.accent.primary }]} /> : null}
            <Text style={[styles.itemTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{item.title}</Text>
            <Text style={{ color: theme.colors.text.secondary, fontSize: 14, fontFamily: theme.typography.fontFamily.body, lineHeight: 20 }}>{item.body}</Text>
            <Text style={{ color: theme.colors.text.tertiary, fontSize: 11, marginTop: 6, fontFamily: theme.typography.fontFamily.body }}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1 },
  itemTitle: { marginBottom: 4, fontSize: 15 },
  unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4 },
});
