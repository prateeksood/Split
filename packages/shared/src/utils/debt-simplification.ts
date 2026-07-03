export interface DebtEdge {
  from: string;
  to: string;
  amount: number;
}

export interface SimplifiedDebt {
  payerId: string;
  payeeId: string;
  amount: number;
}

/**
 * Greedy debt simplification algorithm.
 * Minimizes the number of transactions needed to settle all debts.
 */
export function simplifyDebts(balances: Map<string, number>): SimplifiedDebt[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [userId, balance] of balances) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) {
      creditors.push({ id: userId, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ id: userId, amount: -rounded });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0) {
      result.push({
        payerId: debtor.id,
        payeeId: creditor.id,
        amount: rounded,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return result;
}

export interface PairwiseDebt {
  fromId: string;
  toId: string;
  amount: number;
}

export interface MemberDebtSummary {
  userId: string;
  owes: { userId: string; amount: number }[];
  owedBy: { userId: string; amount: number }[];
}

export interface ExpenseForPairwiseDebt {
  paidById: string;
  splits: { userId: string; amount: number }[];
}

/**
 * Computes net pairwise debts from expenses (who owes whom directly).
 * Positive amount means fromId owes toId.
 */
export function computePairwiseDebts(
  expenses: ExpenseForPairwiseDebt[],
  settlements: { payerId: string; payeeId: string; amount: number }[] = [],
): PairwiseDebt[] {
  const raw = new Map<string, number>();

  const edgeKey = (from: string, to: string) => `${from}:${to}`;

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.userId === expense.paidById) continue;
      const key = edgeKey(split.userId, expense.paidById);
      raw.set(key, Math.round(((raw.get(key) ?? 0) + split.amount) * 100) / 100);
    }
  }

  // A payment from payer→payee reduces what the payer owes the payee.
  for (const s of settlements) {
    const key = edgeKey(s.payerId, s.payeeId);
    raw.set(key, Math.round(((raw.get(key) ?? 0) - s.amount) * 100) / 100);
  }

  const seenPairs = new Set<string>();
  const result: PairwiseDebt[] = [];

  for (const [key, amount] of raw) {
    const [from, to] = key.split(':');
    const pairKey = [from, to].sort().join('|');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const reverse = raw.get(edgeKey(to, from)) ?? 0;
    const net = Math.round((amount - reverse) * 100) / 100;

    if (net > 0.01) {
      result.push({ fromId: from, toId: to, amount: net });
    } else if (net < -0.01) {
      result.push({ fromId: to, toId: from, amount: -net });
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}

export function buildMemberDebtSummaries(
  debts: PairwiseDebt[],
  memberIds: string[],
): MemberDebtSummary[] {
  return memberIds.map((userId) => ({
    userId,
    owes: debts
      .filter((d) => d.fromId === userId)
      .map((d) => ({ userId: d.toId, amount: d.amount })),
    owedBy: debts
      .filter((d) => d.toId === userId)
      .map((d) => ({ userId: d.fromId, amount: d.amount })),
  }));
}

export function computeEqualSplits(
  totalAmount: number,
  participantIds: string[],
): Map<string, number> {
  const count = participantIds.length;
  if (count === 0) return new Map();

  const baseAmount = Math.floor((totalAmount * 100) / count) / 100;
  const remainder = Math.round((totalAmount - baseAmount * count) * 100) / 100;

  const splits = new Map<string, number>();
  participantIds.forEach((id, index) => {
    splits.set(id, baseAmount + (index === 0 ? remainder : 0));
  });

  return splits;
}
