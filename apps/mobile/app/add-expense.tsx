import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { EXPENSE_CATEGORIES, buildExpenseSplits, validateParsedParticipants, mapSplitValuesToUserIds, isValidCategory } from '@split/shared';
import type { ParsedExpense } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api } from '../services/api';
import { useRouteParam } from '../utils/routeParams';
import { invalidateExpenseData } from '../utils/queryInvalidation';
import { parseParsedFromAddExpense } from '../utils/parsedExpenseNavigation';
import { amountsToShareCounts } from '../utils/splitPrefill';
import { useDeleteExpense } from '../hooks/useDeleteExpense';
import { NLInputBar } from '../components/NLInputBar';
import { useToast } from '../components/Toast';
import { ScreenHeader, HeaderIconButton, AppButton, AppTextInput, Chip, noOutline } from '../components/ui';

export default function AddExpenseScreen() {
  const { groupId, expenseId, description: editDescription, amount: editAmount, category: editCategory, fromParsed } =
    useLocalSearchParams<{
      groupId?: string | string[];
      expenseId?: string | string[];
      description?: string | string[];
      amount?: string | string[];
      category?: string | string[];
      fromParsed?: string | string[];
    }>();

  const paramGroupId = useRouteParam(groupId);
  const paramExpenseId = useRouteParam(expenseId);
  const paramDescription = useRouteParam(editDescription);
  const paramAmount = useRouteParam(editAmount);
  const paramCategory = useRouteParam(editCategory);
  const paramFromParsed = useRouteParam(fromParsed);

  const isEditing = !!paramExpenseId;
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState(paramDescription ?? '');
  const [amount, setAmount] = useState(paramAmount ?? '');
  const [category, setCategory] = useState<string>(paramCategory ?? 'Food');
  const [selectedGroupId, setSelectedGroupId] = useState(paramGroupId ?? '');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [paidById, setPaidById] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const { showError, showApiError } = useToast();
  const [loading, setLoading] = useState(false);
  const [editPrefilled, setEditPrefilled] = useState(false);
  const [parsedPrefilled, setParsedPrefilled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingParsed, setPendingParsed] = useState<ParsedExpense | null>(null);

  const { deleteExpense } = useDeleteExpense(selectedGroupId);
  const groupSelected = !!selectedGroupId;
  const showExpenseForm = groupSelected && (!isEditing || editPrefilled);

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api.groups.list() });
  const {
    data: groupDetail,
    isLoading: groupLoading,
    isError: groupError,
  } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => api.groups.get(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const members = useMemo(() => groupDetail?.members ?? [], [groupDetail?.members]);
  const groupCurrency = groupDetail?.currency ?? profile?.defaultCurrency ?? 'USD';
  const editingExpense = useMemo(
    () => (isEditing && paramExpenseId ? groupDetail?.expenses?.find((e) => e.id === paramExpenseId) : undefined),
    [isEditing, paramExpenseId, groupDetail?.expenses],
  );

  const applyParsedToForm = (parsed: ParsedExpense) => {
    setDescription(parsed.description ?? '');
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.category && isValidCategory(parsed.category)) setCategory(parsed.category);
    setSplitType(parsed.split_type);
    setParsedPrefilled(true);

    if (!profile || members.length === 0) {
      setPendingParsed(parsed);
      return;
    }

    const memberList = members.map((m) => ({ id: m.user.id, name: m.user.name }));
    const validation = validateParsedParticipants(
      { participants: parsed.participants, payer: parsed.payer },
      memberList,
      { id: profile.id, name: profile.name },
    );

    if (validation.unknownParticipants.length === 0) {
      setSelectedMemberIds(validation.participantIds);
      setPaidById(validation.payerId);
    }

    const mapped = mapSplitValuesToUserIds(
      parsed.split_values as Record<string, number> | null,
      memberList,
      validation.participantIds,
      { id: profile.id, name: profile.name },
    );
    if (mapped) {
      setSplitValues(Object.fromEntries(Object.entries(mapped).map(([id, v]) => [id, String(v)])));
    }
    setPendingParsed(null);
  };

  const handleAISubmit = async (text: string) => {
    if (!selectedGroupId) return;
    setAiLoading(true);
    try {
      const result = await api.ai.parseExpense(text, selectedGroupId);
      applyParsedToForm(result);
    } catch (e) {
      showApiError(e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (paramGroupId) {
      setSelectedGroupId(paramGroupId);
    }
  }, [paramGroupId]);

  useEffect(() => {
    if (!pendingParsed || !profile || members.length === 0) return;
    applyParsedToForm(pendingParsed);
  }, [pendingParsed, profile, members]);

  useEffect(() => {
    if (!isEditing || !editingExpense || editPrefilled) return;

    const expense = editingExpense;
    const total = Number(expense.amount);
    const splitTypeValue = (expense.splitType ?? 'equal') as 'equal' | 'exact' | 'percentage' | 'shares';

    setDescription(expense.description);
    setAmount(String(total));
    setCategory(expense.category);
    setPaidById(expense.paidBy.id);
    setSplitType(splitTypeValue);
    setSelectedMemberIds(expense.splits.map((s) => s.userId));
    setExistingReceiptUrl(expense.receiptUrl ?? null);

    const values: Record<string, string> = {};
    if (splitTypeValue === 'shares') {
      const shareCounts = amountsToShareCounts(expense.splits.map((s) => Number(s.amount)));
      expense.splits.forEach((split, index) => {
        values[split.userId] = String(shareCounts[index] ?? 1);
      });
    } else {
      for (const split of expense.splits) {
        const splitAmount = Number(split.amount);
        if (splitTypeValue === 'exact') {
          values[split.userId] = String(splitAmount);
        } else if (splitTypeValue === 'percentage' && total > 0) {
          values[split.userId] = String(Math.round((splitAmount / total) * 10000) / 100);
        }
      }
    }
    setSplitValues(values);
    setEditPrefilled(true);
  }, [isEditing, editingExpense, editPrefilled]);

  useEffect(() => {
    if (isEditing || parsedPrefilled || !paramFromParsed) return;
    const parsed = parseParsedFromAddExpense(paramFromParsed);
    if (!parsed) return;

    if (parsed._groupId) setSelectedGroupId(parsed._groupId);
    applyParsedToForm(parsed);
  }, [isEditing, paramFromParsed, parsedPrefilled]);

  useEffect(() => {
    if (isEditing || parsedPrefilled || members.length === 0) return;
    setSelectedMemberIds(members.map((m) => m.user.id));
    setPaidById((current) => current || profile?.id || members[0]?.user.id || '');
  }, [members, profile?.id, isEditing]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        const next = prev.filter((id) => id !== memberId);
        return next.length > 0 ? next : prev;
      }
      return [...prev, memberId];
    });
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('Photo library permission is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const validateSplitInputs = (numAmount: number, participantIds: string[]): string | null => {
    if (splitType === 'equal') return null;

    const values = participantIds.map((id) => parseFloat(splitValues[id] || '0') || 0);

    if (splitType === 'percentage') {
      const total = values.reduce((s, v) => s + v, 0);
      if (Math.abs(total - 100) > 0.01) return 'Percentages must add up to 100%';
    }

    if (splitType === 'exact') {
      const total = values.reduce((s, v) => s + v, 0);
      if (Math.abs(total - numAmount) > 0.01) return 'Split amounts must equal the expense total';
    }

    if (splitType === 'shares' && values.every((v) => v <= 0)) {
      return 'Enter at least one share greater than 0';
    }

    return null;
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!description.trim() || !numAmount || !selectedGroupId || !profile || !groupDetail) {
      showError('Fill all required fields');
      return;
    }

    if (selectedMemberIds.length === 0) {
      showError('Select at least one participant');
      return;
    }

    if (!paidById || !groupDetail.members.some((m) => m.user.id === paidById)) {
      showError('Select who paid');
      return;
    }

    const splitError = validateSplitInputs(numAmount, selectedMemberIds);
    if (splitError) {
      showError(splitError);
      return;
    }

    const parsedSplitValues =
      splitType === 'equal'
        ? undefined
        : Object.fromEntries(
            selectedMemberIds.map((id) => [id, parseFloat(splitValues[id] || '0') || 0]),
          );

    const splits = buildExpenseSplits({
      totalAmount: numAmount,
      splitType,
      participantIds: selectedMemberIds,
      splitValues: parsedSplitValues,
    });

    setLoading(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptUri) {
        try {
          receiptUrl = await api.uploads.uploadReceipt(receiptUri, 'image/jpeg');
        } catch {
          showError('Receipt upload failed — save without receipt or configure S3');
          setLoading(false);
          return;
        }
      }

      if (isEditing && paramExpenseId) {
        await api.expenses.update(paramExpenseId, {
          description: description.trim(),
          amount: numAmount,
          category,
          paidById,
          splitType,
          splits,
          ...(receiptUrl ? { receiptUrl } : {}),
        });
      } else {
        await api.expenses.create({
          groupId: selectedGroupId,
          description: description.trim(),
          amount: numAmount,
          category,
          paidById,
          splitType,
          splits,
          receiptUrl,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      invalidateExpenseData(queryClient, selectedGroupId);
      router.back();
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title={isEditing ? 'Edit Expense' : 'Add Expense'}
        right={<HeaderIconButton icon="close" onPress={() => router.back()} />}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {groups && groups.length === 0 && !isEditing ? (
          <View style={styles.emptyGroup}>
            <Text style={[styles.hint, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
              Create a group first to add expenses and choose members.
            </Text>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: theme.colors.accent.primary, marginTop: 12 }]}
              onPress={() => router.push('/(tabs)/groups')}
            >
              <Text style={styles.saveText}>Go to Groups</Text>
            </Pressable>
          </View>
        ) : null}

        {groups && groups.length > 0 && !isEditing && (
          <>
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Group *</Text>
            <Text style={[styles.hint, { color: theme.colors.text.secondary, marginBottom: 8 }]}>
              Required — members and splits are validated against the selected group.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    setSelectedGroupId(g.id);
                    setSelectedMemberIds([]);
                    setPaidById('');
                    setParsedPrefilled(false);
                    setPendingParsed(null);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: selectedGroupId === g.id ? theme.colors.accent.primary : theme.colors.accent.muted },
                  ]}
                >
                  <Text style={{ color: selectedGroupId === g.id ? '#FFF' : theme.colors.text.primary }}>{g.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {isEditing && groupDetail ? (
          <>
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Group</Text>
            <View style={[styles.groupLocked, { backgroundColor: theme.colors.background.secondary }]}>
              <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>{groupDetail.name}</Text>
            </View>
          </>
        ) : null}

        {!groupSelected && groups && groups.length > 0 && !isEditing ? (
          <View style={[styles.pickGroupBanner, { backgroundColor: theme.colors.accent.muted }]}>
            <Ionicons name="people-outline" size={20} color={theme.colors.accent.primary} />
            <Text style={[styles.hint, { color: theme.colors.text.primary, flex: 1, marginBottom: 0 }]}>
              Select a group above to continue.
            </Text>
          </View>
        ) : null}

        {showExpenseForm ? (
          <>
            {isEditing && !editPrefilled && groupLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.accent.primary} />
                <Text style={{ color: theme.colors.text.secondary, marginLeft: 8 }}>Loading expense…</Text>
              </View>
            ) : null}

            {!isEditing && groupLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.accent.primary} />
                <Text style={{ color: theme.colors.text.secondary, marginLeft: 8 }}>Loading members…</Text>
              </View>
            ) : null}

            {groupError ? (
              <Text style={[styles.hint, { color: theme.colors.accent.danger }]}>
                Could not load group members. Try selecting the group again.
              </Text>
            ) : null}

            {!isEditing && !groupLoading && selectedGroupId ? (
              <View style={styles.aiBarWrap}>
                <NLInputBar
                  onSubmit={handleAISubmit}
                  isLoading={aiLoading}
                  groupName={groupDetail?.name}
                />
              </View>
            ) : null}

            {members.length > 0 && (!isEditing || editPrefilled) ? (
              <>
                <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Paid by</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {members.map((m) => (
                    <Pressable
                      key={m.user.id}
                      onPress={() => setPaidById(m.user.id)}
                      style={[
                        styles.chip,
                        { backgroundColor: paidById === m.user.id ? theme.colors.accent.primary : theme.colors.accent.muted },
                      ]}
                    >
                      <Text style={{ color: paidById === m.user.id ? '#FFF' : theme.colors.text.primary, fontSize: 13 }}>
                        {m.user.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Who is involved?</Text>
                <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
                  Tap to include or exclude group members from this expense.
                </Text>
                <View style={styles.memberSelectRow}>
                  {members.map((m) => {
                    const selected = selectedMemberIds.includes(m.user.id);
                    return (
                      <Pressable
                        key={m.user.id}
                        onPress={() => toggleMember(m.user.id)}
                        style={[
                          styles.memberChip,
                          {
                            backgroundColor: selected ? theme.colors.accent.primary : theme.colors.accent.muted,
                            borderColor: selected ? theme.colors.accent.primary : theme.colors.border.hairline,
                          },
                        ]}
                      >
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={selected ? '#FFF' : theme.colors.text.secondary}
                        />
                        <Text style={{ color: selected ? '#FFF' : theme.colors.text.primary, marginLeft: 6, fontSize: 13 }}>
                          {m.user.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

        <AppTextInput
          label="Description"
          icon="document-text-outline"
          value={description}
          onChangeText={setDescription}
          placeholder="What was it for?"
          containerStyle={{ marginTop: 4 }}
        />

        <View style={{ height: 14 }} />
        <AppTextInput
          label={`Amount (${groupCurrency})`}
          icon="cash-outline"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, { backgroundColor: category === c ? theme.colors.accent.primary : theme.colors.accent.muted }]}
            >
              <Text style={{ color: category === c ? '#FFF' : theme.colors.text.primary, fontSize: 13 }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Split type</Text>
        <View style={styles.splitRow}>
          {(['equal', 'exact', 'percentage', 'shares'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setSplitType(t)}
              style={[styles.chip, { backgroundColor: splitType === t ? theme.colors.accent.primary : theme.colors.accent.muted }]}
            >
              <Text style={{ color: splitType === t ? '#FFF' : theme.colors.text.primary, fontSize: 12 }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {splitType !== 'equal' && members.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {splitType === 'exact' ? 'Amount per person' : splitType === 'percentage' ? '% per person' : 'Shares per person'}
            </Text>
            {members
              .filter((m) => selectedMemberIds.includes(m.user.id))
              .map((m) => (
                <View key={m.user.id} style={styles.splitInputRow}>
                  <Text style={{ color: theme.colors.text.primary, flex: 1 }}>{m.user.name}</Text>
                  <TextInput
                    style={[
                      styles.splitInput,
                      noOutline,
                      {
                        backgroundColor: theme.colors.background.secondary,
                        color: theme.colors.text.primary,
                        borderColor: theme.colors.border.hairline,
                      },
                    ]}
                    value={splitValues[m.user.id] ?? ''}
                    onChangeText={(v) => setSplitValues((prev) => ({ ...prev, [m.user.id]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.text.secondary}
                  />
                </View>
              ))}
          </View>
        )}

        <Text style={[styles.label, { color: theme.colors.text.secondary }]}>Receipt (optional)</Text>
        <Pressable
          style={[styles.receiptBtn, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}
          onPress={pickReceipt}
        >
          <Ionicons name="camera-outline" size={22} color={theme.colors.accent.primary} />
          <Text style={{ color: theme.colors.text.primary, marginLeft: 8, fontFamily: theme.typography.fontFamily.medium }}>
            {receiptUri || existingReceiptUrl ? 'Change receipt photo' : 'Attach receipt photo'}
          </Text>
        </Pressable>
        {receiptUri ? (
          <Image source={{ uri: receiptUri }} style={styles.receiptPreview} resizeMode="cover" />
        ) : existingReceiptUrl ? (
          <Image source={{ uri: existingReceiptUrl }} style={styles.receiptPreview} resizeMode="cover" />
        ) : null}

        <AppButton
          label={isEditing ? 'Update Expense' : 'Save Expense'}
          icon="checkmark-circle"
          size="lg"
          loading={loading}
          onPress={handleSave}
          fullWidth
          style={{ marginTop: 20 }}
        />

        {isEditing && paramExpenseId ? (
          <AppButton
            label="Delete expense"
            icon="trash-outline"
            variant="danger"
            onPress={() => deleteExpense(paramExpenseId, description, selectedGroupId, () => router.back())}
            fullWidth
            style={{ marginTop: 12, marginBottom: 12 }}
          />
        ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, marginBottom: 10, marginTop: 16, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 12.5, marginBottom: 10, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, marginRight: 8 },
  memberSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  memberChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  splitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  splitInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  splitInput: { width: 80, borderWidth: 1, borderRadius: 8, padding: 10, textAlign: 'right' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  receiptPreview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 16 },
  saveBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  emptyGroup: { paddingVertical: 24 },
  pickGroupBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 8 },
  groupLocked: { borderRadius: 12, padding: 14, marginBottom: 12 },
  aiBarWrap: { marginHorizontal: -20, marginBottom: 8 },
  deleteBtn: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12, marginBottom: 24 },
});
