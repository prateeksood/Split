export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Accommodation',
  'Entertainment',
  'Utilities',
  'Shopping',
  'Health',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const SPLIT_TYPES = ['equal', 'exact', 'percentage', 'shares'] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const GROUP_CATEGORIES = ['Home', 'Trip', 'Couple', 'Friends', 'Other'] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

export const GROUP_ACCENT_COLORS = [
  '#7C6FFF',
  '#2DD4BF',
  '#FBBF24',
  '#FB7185',
  '#38BDF8',
  '#34D399',
] as const;

export function getGroupAccentColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash << 5) - hash + groupId.charCodeAt(i);
    hash |= 0;
  }
  return GROUP_ACCENT_COLORS[Math.abs(hash) % GROUP_ACCENT_COLORS.length];
}
