import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../../theme/ThemeProvider';
import { api } from '../../services/api';
import { CreateGroupModal } from '../../components/CreateGroupModal';
import { SkeletonGroupCard } from '../../components/Skeleton';
import { ScreenHeader, HeaderIconButton, EmptyState, Pill } from '../../components/ui';

export default function GroupsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title="Groups"
        large
        right={
          <>
            <HeaderIconButton icon="link-outline" onPress={() => router.push('/join-group')} color={theme.colors.accent.primary} />
            <HeaderIconButton icon="add" onPress={() => setShowCreate(true)} color={theme.colors.accent.primary} />
          </>
        }
      />

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 110, flexGrow: 1 }}
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <SkeletonGroupCard key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="people-outline"
              title="No groups yet"
              message="Create a group for your trip, flat, or friends — then split expenses and settle up effortlessly."
              ctaLabel="New Group"
              onCta={() => setShowCreate(true)}
            />
          )
        }
        renderItem={({ item }) => {
          const isOwed = item.balance >= 0;
          const isSettled = Math.abs(item.balance) < 0.01;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                theme.shadows.sm,
                { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
                pressed ? styles.pressed : null,
              ]}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: item.id } })}
            >
              <LinearGradient
                colors={[item.color, item.color + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>{item.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={styles.cardContent}>
                <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={{ marginTop: 6, flexDirection: 'row' }}>
                  <Pill label={`${item.memberCount} members`} />
                </View>
              </View>
              <View style={styles.balanceCol}>
                <Text
                  style={[
                    styles.balance,
                    {
                      color: isSettled ? theme.colors.text.secondary : isOwed ? theme.colors.accent.success : theme.colors.accent.danger,
                      fontFamily: theme.typography.fontFamily.display,
                    },
                  ]}
                >
                  {formatCurrency(Math.abs(item.balance), profile?.defaultCurrency ?? 'USD')}
                </Text>
                <Text style={[styles.status, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>
                  {isSettled ? 'settled' : isOwed ? 'you are owed' : 'you owe'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <CreateGroupModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ['groups'] })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  cardContent: { flex: 1 },
  name: { fontSize: 16 },
  balanceCol: { alignItems: 'flex-end', marginLeft: 8 },
  balance: { fontSize: 17 },
  status: { fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
