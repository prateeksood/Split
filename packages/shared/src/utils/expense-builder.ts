import { computeEqualSplits } from './debt-simplification';
import type { ExpenseCategory, SplitType } from '../constants/categories';

export interface GroupMember {
  id: string;
  name: string;
}

export interface BuildExpenseSplitsInput {
  totalAmount: number;
  splitType: SplitType;
  participantIds: string[];
  splitValues?: Record<string, number> | null;
}

export function buildExpenseSplits(input: BuildExpenseSplitsInput): { userId: string; amount: number }[] {
  const { totalAmount, splitType, participantIds, splitValues } = input;

  if (participantIds.length === 0) return [];

  if (splitType === 'equal') {
    const map = computeEqualSplits(totalAmount, participantIds);
    return participantIds.map((id) => ({ userId: id, amount: map.get(id) ?? 0 }));
  }

  if (splitType === 'exact' && splitValues) {
    return participantIds.map((id) => ({
      userId: id,
      amount: Number(splitValues[id] ?? 0),
    }));
  }

  if (splitType === 'percentage' && splitValues) {
    return participantIds.map((id) => ({
      userId: id,
      amount: Math.round((totalAmount * Number(splitValues[id] ?? 0)) / 100 * 100) / 100,
    }));
  }

  if (splitType === 'shares' && splitValues) {
    const totalShares = participantIds.reduce((s, id) => s + Number(splitValues[id] ?? 0), 0);
    if (totalShares === 0) {
      const map = computeEqualSplits(totalAmount, participantIds);
      return participantIds.map((id) => ({ userId: id, amount: map.get(id) ?? 0 }));
    }
    return participantIds.map((id) => ({
      userId: id,
      amount: Math.round((totalAmount * Number(splitValues[id] ?? 0)) / totalShares * 100) / 100,
    }));
  }

  const map = computeEqualSplits(totalAmount, participantIds);
  return participantIds.map((id) => ({ userId: id, amount: map.get(id) ?? 0 }));
}

export function canonicalizeParsedExpenseNames(
  parsed: {
    participants: string[];
    payer: string | null;
    split_values: Record<string, number | string> | null;
    description?: string;
  },
  members: GroupMember[],
  currentUser: { id: string; name: string },
): { participants: string[]; payer: string | null; split_values: Record<string, number | string> | null } {
  const resolveName = (name: string): string => {
    if (!name.trim()) return name;
    const lower = name.toLowerCase().trim();
    if (lower === 'you' || lower === 'me' || lower === 'i') return name;
    return matchMemberByName(name, members, currentUser)?.name ?? name;
  };

  const participants: string[] = [];
  for (const name of parsed.participants) {
    const resolved = resolveName(name);
    if (!participants.includes(resolved)) participants.push(resolved);
  }

  let payer = parsed.payer;
  if (payer && payer.toLowerCase() !== 'you') {
    payer = resolveName(payer);
  }

  let split_values: Record<string, number | string> | null = parsed.split_values;
  if (split_values) {
    const canonical: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(split_values)) {
      const exactName = resolveName(key);
      const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
      if (exactName in canonical) {
        canonical[exactName] = Number(canonical[exactName]) + (Number.isFinite(num) ? num : 0);
      } else {
        canonical[exactName] = value;
      }
    }
    split_values = canonical;
  }

  return { participants, payer, split_values };
}

export function validateParsedSplitTotals(
  parsed: { amount: number | null; split_type: string; split_values: Record<string, number | string> | null },
): string | null {
  if (parsed.split_type !== 'exact' || !parsed.split_values || parsed.amount == null) return null;

  const sum = Object.values(parsed.split_values).reduce<number>((total, value) => {
    const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
    return total + (Number.isFinite(num) ? num : 0);
  }, 0);

  if (Math.abs(sum - parsed.amount) > 0.02) {
    return `Split totals (${sum}) do not match expense amount (${parsed.amount}). Try rephrasing or split items separately.`;
  }

  return null;
}

export function matchMemberByName(
  name: string,
  members: GroupMember[],
  currentUser: { id: string; name: string },
): GroupMember | undefined {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return undefined;
  if (normalized === 'you' || normalized === 'me' || normalized === 'i' || normalized === currentUser.name.toLowerCase()) {
    return members.find((m) => m.id === currentUser.id) ?? { id: currentUser.id, name: currentUser.name };
  }
  return members.find(
    (m) =>
      m.name.toLowerCase() === normalized ||
      m.name.toLowerCase().startsWith(normalized) ||
      normalized.startsWith(m.name.toLowerCase().split(' ')[0] ?? ''),
  );
}

export interface ParticipantValidationResult {
  participantIds: string[];
  payerId: string;
  unknownParticipants: string[];
  unknownPayer: string | null;
}

export function validateParsedParticipants(
  parsed: { participants: string[]; payer: string | null },
  members: GroupMember[],
  currentUser: { id: string; name: string },
): ParticipantValidationResult {
  const unknownParticipants: string[] = [];
  const participantIds: string[] = [];

  const namesToResolve =
    parsed.participants.length > 0 ? parsed.participants : members.map((m) => m.name);

  for (const name of namesToResolve) {
    const match = matchMemberByName(name, members, currentUser);
    if (match) {
      if (!participantIds.includes(match.id)) participantIds.push(match.id);
    } else {
      unknownParticipants.push(name);
    }
  }

  let payerId = currentUser.id;
  let unknownPayer: string | null = null;
  if (parsed.payer?.trim()) {
    const payerMatch = matchMemberByName(parsed.payer, members, currentUser);
    if (payerMatch) {
      payerId = payerMatch.id;
    } else {
      unknownPayer = parsed.payer;
    }
  }

  if (participantIds.length === 0 && unknownParticipants.length === 0) {
    participantIds.push(...members.map((m) => m.id));
  }

  if (!participantIds.includes(payerId) && !unknownPayer) {
    participantIds.push(payerId);
  }

  return { participantIds, payerId, unknownParticipants, unknownPayer };
}

export function mapSplitValuesToUserIds(
  splitValues: Record<string, number> | null | undefined,
  members: GroupMember[],
  participantIds: string[],
  currentUser: { id: string; name: string },
): Record<string, number> | undefined {
  if (!splitValues) return undefined;

  const mapped: Record<string, number> = {};
  for (const [key, value] of Object.entries(splitValues)) {
    const byId = members.find((m) => m.id === key);
    if (byId && participantIds.includes(byId.id)) {
      mapped[byId.id] = Number(value);
      continue;
    }
    const byName = matchMemberByName(key, members, currentUser);
    if (byName && participantIds.includes(byName.id)) {
      mapped[byName.id] = Number(value);
    }
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

export function resolveMemberIds(
  participantNames: string[],
  members: GroupMember[],
  currentUser: { id: string; name: string },
): string[] {
  const result = validateParsedParticipants({ participants: participantNames, payer: null }, members, currentUser);
  if (result.unknownParticipants.length > 0) {
    return result.participantIds.length > 0 ? result.participantIds : [currentUser.id];
  }
  return result.participantIds.length > 0 ? result.participantIds : [currentUser.id];
}

export function matchGroupByHint(
  hint: string | null,
  groups: { id: string; name: string }[],
): string | undefined {
  if (!hint) return undefined;
  const lower = hint.toLowerCase();
  return groups.find((g) => g.name.toLowerCase().includes(lower) || lower.includes(g.name.toLowerCase()))?.id;
}

export function isValidCategory(cat: string): cat is ExpenseCategory {
  return ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Other'].includes(cat);
}
