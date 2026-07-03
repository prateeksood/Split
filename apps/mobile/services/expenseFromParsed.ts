import type { ParsedExpense } from '@split/shared';
import {
  buildExpenseSplits,
  validateParsedParticipants,
  mapSplitValuesToUserIds,
  matchGroupByHint,
  isValidCategory,
} from '@split/shared';
import type { CreateExpensePayload, GroupMember, UserProfile } from './api';
import { resolveParsedExpenseDate } from '../utils/parsedExpenseDate';

export type BuildExpenseResult =
  | { ok: true; payload: CreateExpensePayload }
  | { ok: false; error: string };

export function buildExpenseFromParsed(
  parsed: ParsedExpense,
  profile: UserProfile,
  groups: { id: string; name: string; currency?: string }[],
  groupMembers: GroupMember[],
  groupIdOverride?: string,
): BuildExpenseResult {
  if (!parsed.amount || parsed.amount <= 0) {
    return { ok: false, error: 'Could not determine expense amount' };
  }

  const groupId = groupIdOverride ?? matchGroupByHint(parsed.group_hint, groups);
  if (!groupId) {
    return { ok: false, error: 'Could not determine which group this expense belongs to' };
  }

  const members = groupMembers.map((m) => ({ id: m.user.id, name: m.user.name }));
  const validation = validateParsedParticipants(
    { participants: parsed.participants, payer: parsed.payer },
    members,
    { id: profile.id, name: profile.name },
  );

  if (validation.unknownPayer) {
    return {
      ok: false,
      error: `Unknown payer "${validation.unknownPayer}". Only existing group members can be included.`,
    };
  }

  if (validation.unknownParticipants.length > 0) {
    return {
      ok: false,
      error: `Unknown participants: ${validation.unknownParticipants.join(', ')}. Add them via Edit Group first.`,
    };
  }

  const participantIds = validation.participantIds;
  const splitValues = mapSplitValuesToUserIds(
    parsed.split_values as Record<string, number> | null,
    members,
    participantIds,
    { id: profile.id, name: profile.name },
  );

  const splits = buildExpenseSplits({
    totalAmount: parsed.amount,
    splitType: parsed.split_type,
    participantIds,
    splitValues,
  });

  const date = resolveParsedExpenseDate(parsed.date);

  return {
    ok: true,
    payload: {
      groupId,
      description: parsed.description || 'Expense',
      amount: parsed.amount,
      category: isValidCategory(parsed.category) ? parsed.category : 'Other',
      paidById: validation.payerId,
      splitType: parsed.split_type,
      splits,
      ...(date ? { date } : {}),
    },
  };
}
