import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import type { ParsedExpense } from '@split/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../services/api';
import { buildExpenseFromParsed } from '../services/expenseFromParsed';
import type { GroupSummary } from '../services/api';
import { invalidateExpenseData } from '../utils/queryInvalidation';
import { notifySuccess } from '../services/haptics';

interface UseNLExpenseOptions {
  groupId?: string;
  onSuccess?: () => void;
}

function resolveGroupFromHint(groups: GroupSummary[], hint: string | null): GroupSummary | undefined {
  if (!hint) return undefined;
  const lower = hint.toLowerCase();
  return groups.find(
    (g) => g.name.toLowerCase().includes(lower) || lower.includes(g.name.toLowerCase()),
  );
}

export function useNLExpense({ groupId, onSuccess }: UseNLExpenseOptions = {}) {
  const queryClient = useQueryClient();
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleNLSubmit = useCallback(
    async (text: string) => {
      setAiLoading(true);
      setSaveError('');
      try {
        const groups: GroupSummary[] = await api.groups.list();

        if (!groups.length) {
          setSaveError('Create a group first, then add expenses with AI.');
          return;
        }

        const parsed = await api.ai.parseExpense(text, groupId);
        setParsedExpense(parsed);
        setShowConfirmation(true);
      } catch (e) {
        setSaveError(getApiErrorMessage(e));
      } finally {
        setAiLoading(false);
      }
    },
    [groupId],
  );

  const handleSaveExpense = useCallback(async (): Promise<boolean> => {
    if (!parsedExpense) return false;

    setSaveLoading(true);
    setSaveError('');

    const profile = await api.users.me();
    const groups: GroupSummary[] = await api.groups.list();
    if (!groups.length) {
      setSaveError('Create a group first, then try again');
      setSaveLoading(false);
      return false;
    }

    const targetGroup =
      (groupId ? groups.find((g: GroupSummary) => g.id === groupId) : undefined) ??
      resolveGroupFromHint(groups, parsedExpense.group_hint) ??
      groups[0];

    let groupDetail;
    try {
      groupDetail = await api.groups.get(targetGroup.id);
    } catch {
      setSaveError('Could not load group details');
      setSaveLoading(false);
      return false;
    }

    const result = buildExpenseFromParsed(
      parsedExpense,
      profile,
      groups.map((g: GroupSummary) => ({ id: g.id, name: g.name })),
      groupDetail.members,
      targetGroup.id,
    );

    if (!result.ok) {
      setSaveError(result.error);
      setSaveLoading(false);
      return false;
    }

    try {
      await api.expenses.create(result.payload);
      notifySuccess();
      setShowConfirmation(false);
      setParsedExpense(null);
      invalidateExpenseData(queryClient, targetGroup.id);
      onSuccess?.();
      setSaveLoading(false);
      return true;
    } catch (e) {
      setSaveError(getApiErrorMessage(e));
      setSaveLoading(false);
      return false;
    }
  }, [parsedExpense, groupId, queryClient, onSuccess]);

  const dismissConfirmation = useCallback(() => {
    setShowConfirmation(false);
    setParsedExpense(null);
    setSaveError('');
  }, []);

  return {
    aiLoading,
    saveLoading,
    parsedExpense,
    setParsedExpense,
    showConfirmation,
    saveError,
    setSaveError,
    handleNLSubmit,
    handleSaveExpense,
    dismissConfirmation,
    resolveTargetGroupId: useCallback(
      (groups: GroupSummary[]) =>
        (groupId ? groups.find((g) => g.id === groupId)?.id : undefined) ??
        resolveGroupFromHint(groups, parsedExpense?.group_hint ?? null)?.id ??
        groups[0]?.id,
      [groupId, parsedExpense?.group_hint],
    ),
  };
}

export function showVoiceUnavailableAlert() {
  Alert.alert(
    'Voice input unavailable',
    Platform.OS === 'web'
      ? 'Try Chrome or Edge for voice input, or type your expense instead.'
      : 'Voice input requires a development build with microphone permissions.',
  );
}
