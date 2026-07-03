import { useState } from 'react';

import {

  View,

  Text,

  StyleSheet,

  ScrollView,

  Pressable,

  RefreshControl,

} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

import { formatCurrency } from '@split/shared';

import { useTheme } from '../../theme/ThemeProvider';

import { ScreenHeader, HeaderIconButton, SectionHeader, Avatar, AppTextInput } from '../../components/ui';

import { api } from '../../services/api';

import { SwipeableExpenseListItem } from '../../components/SwipeableExpenseListItem';

import { NLInputBar } from '../../components/NLInputBar';
import { useToast } from '../../components/Toast';

import { EditGroupModal } from '../../components/EditGroupModal';
import { ManageMembersModal } from '../../components/ManageMembersModal';

import { SkeletonHeroCard, SkeletonExpenseItem } from '../../components/Skeleton';

import { useRouteParam } from '../../utils/routeParams';

import { serializeParsedForAddExpense } from '../../utils/parsedExpenseNavigation';

import { useDeleteExpense } from '../../hooks/useDeleteExpense';



export default function GroupDetailScreen() {

  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();

  const id = useRouteParam(rawId);

  const theme = useTheme();

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();

  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const [expenseSearch, setExpenseSearch] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const { showApiError } = useToast();



  const { deleteExpense } = useDeleteExpense(id);



  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });



  const { data: group, isLoading, isError, refetch, isRefetching } = useQuery({

    queryKey: ['group', id],

    queryFn: () => api.groups.get(id!),

    enabled: !!id,

  });



  const groupCurrency = group?.currency ?? profile?.defaultCurrency ?? 'USD';



  const handleNLSubmit = async (text: string) => {

    if (!id) return;

    setAiLoading(true);
    try {
      const result = await api.ai.parseExpense(text, id);
      router.push({
        pathname: '/add-expense',
        params: { fromParsed: serializeParsedForAddExpense(result, id) },
      });
    } catch (e) {
      showApiError(e);
    } finally {

      setAiLoading(false);

    }

  };



  const memberName = (userId: string) => group?.members.find((m) => m.user.id === userId)?.user.name ?? '?';



  if (!id) {

    return (

      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top, padding: 20 }]}>

        <Text style={{ color: theme.colors.text.primary }}>Invalid group link.</Text>

        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>

          <Text style={{ color: theme.colors.accent.primary }}>Go back</Text>

        </Pressable>

      </View>

    );

  }



  if (isError) {

    return (

      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top, padding: 20 }]}>

        <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>Could not load group</Text>

        <Pressable onPress={() => refetch()} style={{ marginTop: 16 }}>

          <Text style={{ color: theme.colors.accent.primary }}>Retry</Text>

        </Pressable>

      </View>

    );

  }



  if (isLoading || !group) {

    return (

      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>

        <SkeletonHeroCard />

        {[1, 2, 3].map((i) => (

          <SkeletonExpenseItem key={i} />

        ))}

      </View>

    );

  }



  const isOwed = group.userBalance >= 0;

  const pairwiseDebts = group.pairwiseDebts ?? [];

  const memberSummaries = group.memberDebtSummaries ?? [];

  const expenseQuery = expenseSearch.trim().toLowerCase();

  const visibleExpenses = expenseQuery

    ? (group.expenses ?? []).filter(

        (e) =>

          e.description.toLowerCase().includes(expenseQuery) ||

          e.category.toLowerCase().includes(expenseQuery) ||

          e.paidBy.name.toLowerCase().includes(expenseQuery),

      )

    : group.expenses ?? [];



  return (

    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>

      <ScreenHeader
        title={group.name}
        onBack={() => router.back()}
        right={
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <HeaderIconButton icon="person-add-outline" onPress={() => setShowManageMembers(true)} color={theme.colors.accent.primary} />
            <HeaderIconButton icon="create-outline" onPress={() => setShowEditGroup(true)} color={theme.colors.accent.primary} />
          </View>
        }
      />

      <View style={[styles.heroWrap, theme.shadows.lg]}>
        <LinearGradient colors={theme.colors.gradient.brandVibrant} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBlob} />
          <Text style={[styles.balanceLabel, { fontFamily: theme.typography.fontFamily.body }]}>
            {isOwed ? 'You are owed in this group' : 'You owe in this group'}
          </Text>
          <Text style={[styles.balanceAmount, { fontFamily: theme.typography.fontFamily.displayExtra }]}>
            {formatCurrency(Math.abs(group.userBalance), groupCurrency)}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.frosted, pressed ? styles.pressed : null]}
              onPress={() => router.push({ pathname: '/settle-up', params: { groupId: id } })}
            >
              <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
              <Text style={[styles.frostedText, { fontFamily: theme.typography.fontFamily.display }]}>Settle Up</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.solid, pressed ? styles.pressed : null]}
              onPress={() => router.push({ pathname: '/add-expense', params: { groupId: id } })}
            >
              <Ionicons name="add" size={20} color={theme.colors.accent.primaryDark} />
              <Text style={[styles.solidText, { color: theme.colors.accent.primaryDark, fontFamily: theme.typography.fontFamily.display }]}>Add Expense</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>



      <NLInputBar onSubmit={handleNLSubmit} isLoading={aiLoading} groupName={group.name} />

      <ScrollView

        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent.primary} />}

        contentContainerStyle={{ paddingBottom: 40 }}

      >

        <View style={styles.sectionHeader}>

          <Text style={[styles.section, { color: theme.colors.text.primary, marginTop: 0, marginBottom: 0, paddingHorizontal: 0, fontFamily: theme.typography.fontFamily.display }]}>Members</Text>

          <Pressable onPress={() => setShowManageMembers(true)}>

            <Text style={{ color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.medium, fontSize: 14 }}>Manage members</Text>

          </Pressable>

        </View>

        <View style={styles.memberRow}>

          {group.members.map((m) => (

            <View key={m.user.id} style={[styles.memberChip, { backgroundColor: theme.colors.accent.muted }]}>

              <Avatar name={m.user.name} size={26} />

              <Text style={{ color: theme.colors.text.primary, fontSize: 13, fontFamily: theme.typography.fontFamily.medium }}>{m.user.name}</Text>

            </View>

          ))}

        </View>



        {(pairwiseDebts.length > 0 || memberSummaries.some((s) => s.owes.length > 0 || s.owedBy.length > 0)) && (

          <>

            <Text style={[styles.section, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Balance Summary</Text>

            <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>

              How much each member owes or is owed within this group.

            </Text>

            {memberSummaries.map((summary) => {

              const hasDebts = summary.owes.length > 0 || summary.owedBy.length > 0;

              if (!hasDebts) return null;

              const net = group.balances?.[summary.userId] ?? 0;

              return (

                <View key={summary.userId} style={[styles.summaryCard, theme.shadows.sm, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}>

                  <View style={styles.summaryHeader}>

                    <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 15 }}>

                      {memberName(summary.userId)}

                    </Text>

                    <Text

                      style={{

                        color: net >= 0 ? theme.colors.accent.success : theme.colors.accent.danger,

                        fontSize: 13,

                        fontWeight: '600',

                      }}

                    >

                      {net >= 0 ? '+' : ''}

                      {formatCurrency(net, groupCurrency)}

                    </Text>

                  </View>

                  {summary.owes.map((d) => (

                    <Text key={`owes-${d.userId}`} style={{ color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 }}>

                      owes {memberName(d.userId)} {formatCurrency(d.amount, groupCurrency)}

                    </Text>

                  ))}

                  {summary.owedBy.map((d) => (

                    <Text key={`owed-${d.userId}`} style={{ color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 }}>

                      is owed by {memberName(d.userId)} {formatCurrency(d.amount, groupCurrency)}

                    </Text>

                  ))}

                </View>

              );

            })}

          </>

        )}



        {group.simplifiedDebts?.length > 0 && (

          <>

            <Text style={[styles.section, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Suggested Settlements</Text>

            {group.simplifiedDebts.map((d) => (

              <Pressable

                key={`${d.payerId}-${d.payeeId}`}

                style={[styles.debtRow, theme.shadows.sm, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}

                onPress={() =>

                  router.push({

                    pathname: '/settle-up',

                    params: {

                      groupId: id,

                      amount: String(d.amount),

                      ...(d.payerId === profile?.id

                        ? { mode: 'pay', payeeId: d.payeeId }

                        : d.payeeId === profile?.id

                          ? { mode: 'receive', payerId: d.payerId }

                          : {}),

                    },

                  })

                }

              >

                <View style={[styles.debtIcon, { backgroundColor: theme.colors.accent.primary + '22' }]}>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.accent.primary} />
                </View>
                <Text style={{ color: theme.colors.text.primary, fontSize: 14, flex: 1, fontFamily: theme.typography.fontFamily.medium }}>

                  {memberName(d.payerId)} pays {memberName(d.payeeId)}

                </Text>

                <Text style={{ color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 14 }}>{formatCurrency(d.amount, groupCurrency)}</Text>

              </Pressable>

            ))}

          </>

        )}



        <Text style={[styles.section, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Expenses</Text>

        {group.expenses?.length ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <AppTextInput
              icon="search-outline"
              placeholder="Search expenses…"
              value={expenseSearch}
              onChangeText={setExpenseSearch}
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {visibleExpenses.length ? (

          visibleExpenses.map((e) => {

            const amount = Number(e.amount);

            const userShare = Number(e.splits.find((s) => s.userId === profile?.id)?.amount ?? 0);

            return (

              <SwipeableExpenseListItem

                key={e.id}

                expenseId={e.id}

                groupId={id}

                description={e.description}

                category={e.category}

                amount={amount}

                currency={e.currency}

                paidByName={e.paidBy.name}

                date={e.date}

                userShare={userShare}

                userPaid={e.paidBy.id === profile?.id}

                onSettle={() => router.push({ pathname: '/settle-up', params: { groupId: id } })}

                onEdit={() =>

                  router.push({

                    pathname: '/add-expense',

                    params: {

                      groupId: id,

                      expenseId: e.id,

                      description: e.description,

                      amount: String(amount),

                      category: e.category,

                    },

                  })

                }

                onDelete={() => deleteExpense(e.id, e.description)}

              />

            );

          })

        ) : (

          <Text style={[styles.empty, { color: theme.colors.text.secondary }]}>

            {group.expenses?.length ? 'No expenses match your search' : 'No expenses yet'}

          </Text>

        )}

      </ScrollView>



      <EditGroupModal
        visible={showEditGroup}
        groupId={id!}
        groupName={group.name}
        groupCurrency={group.currency}
        members={group.members}
        onClose={() => setShowEditGroup(false)}
        onUpdated={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
        onArchived={() => {
          setShowEditGroup(false);
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          router.back();
        }}
      />

      <ManageMembersModal
        visible={showManageMembers}
        groupId={id!}
        groupName={group.name}
        members={group.members}
        onClose={() => setShowManageMembers(false)}
        onUpdated={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['groups'] });
        }}
        onLeft={() => {
          setShowManageMembers(false);
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          router.back();
        }}
      />

    </View>

  );

}



const styles = StyleSheet.create({
  container: { flex: 1 },
  heroWrap: { marginHorizontal: 20, borderRadius: 28, marginBottom: 4, marginTop: 4 },
  hero: { borderRadius: 28, padding: 22, overflow: 'hidden' },
  heroBlob: { position: 'absolute', top: -50, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.12)' },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  balanceAmount: { fontSize: 38, color: '#FFFFFF', marginTop: 4, marginBottom: 18, letterSpacing: -0.5 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14 },
  frosted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  frostedText: { color: '#FFFFFF', fontSize: 15 },
  solid: { backgroundColor: '#FFFFFF' },
  solidText: { fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20, marginBottom: 8 },
  section: { fontSize: 17, paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  hint: { fontSize: 12.5, paddingHorizontal: 20, marginBottom: 12, lineHeight: 18 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 9999 },
  summaryCard: { marginHorizontal: 20, padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, padding: 14, borderRadius: 18, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth },
  debtIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24 },
});

