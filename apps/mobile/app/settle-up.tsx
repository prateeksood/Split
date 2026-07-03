import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../services/api';
import { useRouteParam } from '../utils/routeParams';
import { invalidateExpenseData } from '../utils/queryInvalidation';
import { ScreenHeader, HeaderIconButton, AppButton, AppTextInput, Chip, Card } from '../components/ui';

// Settlements are payer-only on the server — only "You paid" is valid.
// "You received" would require the server to set payeeId = callerId, which is disallowed.

export default function SettleUpScreen() {
  const { groupId, payeeId: paramPayeeId, payerId: paramPayerId, amount: paramAmount, mode: paramMode } = useLocalSearchParams<{
    groupId?: string | string[];
    payeeId?: string | string[];
    payerId?: string | string[];
    amount?: string | string[];
    mode?: string | string[];
  }>();
  const paramGroupId = useRouteParam(groupId);
  const prefilledPayeeId = useRouteParam(paramPayeeId);
  const prefilledPayerId = useRouteParam(paramPayerId);
  const prefilledAmount = useRouteParam(paramAmount);
  const prefilledMode = useRouteParam(paramMode);
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState(paramGroupId ?? '');
  const [amount, setAmount] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [note, setNote] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api.groups.list() });
  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => api.groups.get(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (paramGroupId) setSelectedGroupId(paramGroupId);
  }, [paramGroupId]);

  useEffect(() => {
    if (!paramGroupId && groups?.length && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [paramGroupId, groups, selectedGroupId]);

  const groupCurrency = group?.currency ?? profile?.defaultCurrency ?? 'USD';

  useEffect(() => {
    if (prefilledPayeeId) setCounterpartyId(prefilledPayeeId);
    // prefilledPayerId = someone who paid you. Ask them to record it, or record yourself paying them back.
    if (prefilledPayerId) setCounterpartyId(prefilledPayerId);
    if (prefilledAmount) setAmount(prefilledAmount);
  }, [prefilledPayeeId, prefilledPayerId, prefilledAmount]);

  const otherMembers = group?.members.filter((m) => m.user.id !== profile?.id) ?? [];
  const debtsYouOwe = group?.simplifiedDebts?.filter((d) => d.payerId === profile?.id) ?? [];

  const handleSettle = async () => {
    const numAmount = parseFloat(amount);
    if (!counterpartyId || !numAmount || !profile) {
      setError('Select a person and amount');
      return;
    }

    const payerId = profile.id;
    const payeeId = counterpartyId;

    setLoading(true);
    setError('');
    try {
      await api.settlements.create({
        payerId,
        payeeId,
        amount: numAmount,
        groupId: selectedGroupId || undefined,
        note: note || undefined,
        paymentRef: paymentRef || undefined,
      });
      invalidateExpenseData(queryClient, selectedGroupId || undefined);
      router.back();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const memberName = (userId: string) =>
    group?.members.find((m) => m.user.id === userId)?.user.name ?? '?';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Settle Up" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {groups && groups.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
              Join or create a group to record settlements with members.
            </Text>
            <AppButton label="Go to Groups" onPress={() => router.push('/(tabs)/groups')} style={{ marginTop: 12 }} />
          </View>
        ) : null}

        {groups && groups.length > 1 && (
          <>
            <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 4 }}>
              {groups.map((g) => (
                <Chip
                  key={g.id}
                  label={g.name}
                  selected={selectedGroupId === g.id}
                  onPress={() => {
                    setSelectedGroupId(g.id);
                    setCounterpartyId('');
                    setAmount('');
                  }}
                />
              ))}
            </ScrollView>
          </>
        )}

        <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
          Record that you paid someone. Ask them to open Split and record if they paid you.
        </Text>

        {groupLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.accent.primary} />
            <Text style={{ color: theme.colors.text.secondary, marginLeft: 8, fontFamily: theme.typography.fontFamily.body }}>Loading group…</Text>
          </View>
        ) : null}

        {debtsYouOwe.length > 0 && (
          <>
            <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Suggested</Text>
            {debtsYouOwe.map((d) => (
              <Card
                key={`${d.payerId}-${d.payeeId}`}
                style={{ marginBottom: 8 }}
                onPress={() => {
                  setCounterpartyId(d.payeeId);
                  setAmount(String(d.amount));
                }}
              >
                <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }}>
                  {`Pay ${memberName(d.payeeId)}: ${formatCurrency(d.amount, groupCurrency)}`}
                </Text>
              </Card>
            ))}
          </>
        )}

        <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Pay to</Text>
        {otherMembers.length > 0 ? (
          <View style={styles.chipRow}>
            {otherMembers.map((m) => (
              <Chip key={m.user.id} label={m.user.name} selected={counterpartyId === m.user.id} onPress={() => setCounterpartyId(m.user.id)} />
            ))}
          </View>
        ) : (
          <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
            {selectedGroupId ? 'No other members in this group.' : 'Select a group first.'}
          </Text>
        )}

        <View style={{ height: 16 }} />
        <AppTextInput
          label={`Amount (${groupCurrency})`}
          icon="cash-outline"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          containerStyle={{ marginBottom: 12 }}
        />
        <AppTextInput
          icon="card-outline"
          value={paymentRef}
          onChangeText={setPaymentRef}
          placeholder="UPI ID / payment reference (optional)"
          containerStyle={{ marginBottom: 12 }}
        />
        <AppTextInput
          icon="create-outline"
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
        />

        {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

        <AppButton label="Record Settlement" icon="checkmark-circle" size="lg" loading={loading} onPress={handleSettle} fullWidth style={{ marginTop: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 13, marginBottom: 10, marginTop: 16 },
  hint: { fontSize: 12.5, marginBottom: 8, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
