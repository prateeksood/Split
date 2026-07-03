import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { api } from '../../services/api';
import { useDeleteExpense } from '../../hooks/useDeleteExpense';
import { BalanceHeroCard } from '../../components/BalanceHeroCard';
import { GroupCardList } from '../../components/GroupCard';
import { SwipeableExpenseListItem } from '../../components/SwipeableExpenseListItem';
import { SkeletonHeroCard, SkeletonExpenseItem } from '../../components/Skeleton';
import { Avatar, SectionHeader, EmptyState, HeaderIconButton } from '../../components/ui';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deleteExpense } = useDeleteExpense();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.me(),
  });

  const { data: dashboard, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.users.dashboard(),
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.notifications.unreadCount(),
  });

  const firstName = profile?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.push('/settings')}>
            <Avatar name={profile?.name ?? 'You'} size={44} />
          </Pressable>
          <View style={styles.greetingWrap}>
            <Text style={[styles.hello, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
              Welcome back
            </Text>
            <Text style={[styles.greeting, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>
              {firstName} 👋
            </Text>
          </View>
        </View>
        <View>
          <HeaderIconButton icon="notifications-outline" onPress={() => router.push('/notifications')} />
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.accent.danger, borderColor: theme.colors.background.primary }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
      >
        {isLoading ? (
          <SkeletonHeroCard />
        ) : (
          <BalanceHeroCard
            totalBalance={dashboard?.totalBalance ?? 0}
            currency={dashboard?.totalCurrency ?? profile?.defaultCurrency}
            userName={profile?.name}
            onSettleUp={() => router.push('/settle-up')}
            onAddExpense={() => router.push('/select-group')}
          />
        )}

        {dashboard?.groups && dashboard.groups.length > 0 && (
          <>
            <SectionHeader
              title="Your groups"
              actionLabel="See all"
              onAction={() => router.push('/(tabs)/groups')}
            />
            <GroupCardList
              groups={dashboard.groups.map((g) => ({
                ...g,
                color: g.color ?? '#7C6FFF',
              }))}
              currency={profile?.defaultCurrency}
              onGroupPress={(id) => router.push({ pathname: '/group/[id]', params: { id } })}
            />
          </>
        )}

        <SectionHeader title="Recent activity" />

        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <SkeletonExpenseItem key={i} />
            ))}
          </>
        ) : dashboard?.recentActivity?.length ? (
          dashboard.recentActivity.map((item) => (
            <SwipeableExpenseListItem
              key={item.id}
              expenseId={item.id}
              groupId={item.groupId}
              description={item.description}
              category={item.category}
              amount={item.amount}
              currency={item.currency}
              groupName={item.groupName}
              paidByName={item.paidByName}
              date={item.date}
              userShare={item.userShare}
              userPaid={item.userPaid}
              onSettle={() =>
                router.push({
                  pathname: '/settle-up',
                  params: item.groupId ? { groupId: item.groupId } : {},
                })
              }
              onEdit={() =>
                router.push({
                  pathname: '/add-expense',
                  params: {
                    groupId: item.groupId ?? '',
                    expenseId: item.id,
                    description: item.description,
                    amount: String(item.amount),
                    category: item.category,
                  },
                })
              }
              onDelete={() => deleteExpense(item.id, item.description, item.groupId)}
            />
          ))
        ) : (
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            message="Open a group and add your first expense — or use AI voice/text entry to log it instantly."
            ctaLabel="Add Expense"
            onCta={() => router.push('/select-group')}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greetingWrap: { marginLeft: 12, flex: 1 },
  hello: { fontSize: 13 },
  greeting: { fontSize: 20, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
