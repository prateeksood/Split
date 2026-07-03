/** Resolve AI-parsed date strings to ISO datetime for the API. */
export function resolveParsedExpenseDate(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;

  const normalized = raw.trim().toLowerCase();
  const now = new Date();

  if (normalized === 'today') {
    return now.toISOString();
  }

  if (normalized === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return undefined;
}
