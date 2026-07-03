import type { ParsedExpense } from '@split/shared';

export function serializeParsedForAddExpense(parsed: ParsedExpense, groupId?: string): string {
  return JSON.stringify({ ...parsed, _groupId: groupId });
}

export function parseParsedFromAddExpense(raw: string | undefined): (ParsedExpense & { _groupId?: string }) | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as ParsedExpense & { _groupId?: string };
  } catch {
    return null;
  }
}
