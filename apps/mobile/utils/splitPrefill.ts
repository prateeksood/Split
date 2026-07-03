/** Convert stored split dollar amounts back into share counts for the shares split UI. */
export function amountsToShareCounts(amounts: number[]): number[] {
  if (amounts.length === 0) return [];

  const cents = amounts.map((a) => Math.round(a * 100));
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  const divisor = cents.reduce((acc, c) => (c > 0 ? gcd(acc, c) : acc), cents.find((c) => c > 0) ?? 1);

  if (divisor <= 0) {
    return amounts.map(() => 1);
  }

  return cents.map((c) => Math.max(c > 0 ? Math.round(c / divisor) : 0, c > 0 ? 1 : 0));
}
