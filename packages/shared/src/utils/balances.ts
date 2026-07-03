export interface BalanceEntry {
  userId: string;
  amount: number;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  paid: number;
}

/**
 * Calculate net balances from expense splits.
 * Positive = user is owed money, negative = user owes money.
 */
export function calculateBalances(splits: ExpenseSplit[]): Map<string, number> {
  const balances = new Map<string, number>();

  for (const split of splits) {
    const current = balances.get(split.userId) ?? 0;
    balances.set(split.userId, current + split.paid - split.amount);
  }

  return balances;
}

export interface SettlementEntry {
  payerId: string;
  payeeId: string;
  amount: number;
}

/**
 * Apply settlements (payments) to a balance map.
 * When payer pays payee, the payer's debt is reduced (balance goes up) and the
 * payee's credit is reduced (balance goes down), so a fully-settled pair nets to 0.
 * Mutates and returns the same map.
 */
export function applySettlements(
  balances: Map<string, number>,
  settlements: SettlementEntry[],
): Map<string, number> {
  for (const s of settlements) {
    balances.set(s.payerId, (balances.get(s.payerId) ?? 0) + s.amount);
    balances.set(s.payeeId, (balances.get(s.payeeId) ?? 0) - s.amount);
  }
  return balances;
}

export function getNetBalance(balances: Map<string, number>, userId: string): number {
  return balances.get(userId) ?? 0;
}

export function sumBalances(balances: Map<string, number>): number {
  let sum = 0;
  for (const amount of balances.values()) {
    sum += amount;
  }
  return Math.round(sum * 100) / 100;
}
