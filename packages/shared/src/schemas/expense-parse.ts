import { z } from 'zod';
import { EXPENSE_CATEGORIES, SPLIT_TYPES, type ExpenseCategory } from '../constants/categories';

export const confidenceSchema = z.object({
  payer: z.number().min(0).max(1),
  amount: z.number().min(0).max(1),
  participants: z.number().min(0).max(1),
  split_type: z.number().min(0).max(1),
});

export const parsedExpenseSchema = z.object({
  payer: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().length(3),
  date: z.string().nullable(),
  description: z.string(),
  category: z.enum(EXPENSE_CATEGORIES),
  participants: z.array(z.string()),
  split_type: z.enum(SPLIT_TYPES),
  split_values: z.record(z.union([z.number(), z.string()])).nullable(),
  group_hint: z.string().nullable(),
  confidence: confidenceSchema,
  ambiguities: z.array(z.string()),
  line_items: z.array(z.any()).nullable().optional(),
});

export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;
export type ConfidenceScores = z.infer<typeof confidenceSchema>;

export const CONFIDENCE_THRESHOLD = 0.7;

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  grocery: 'Food',
  groceries: 'Food',
  restaurant: 'Food',
  dining: 'Food',
  lunch: 'Food',
  dinner: 'Food',
  breakfast: 'Food',
  cafe: 'Food',
  coffee: 'Food',
  taxi: 'Transport',
  uber: 'Transport',
  cab: 'Transport',
  flight: 'Transport',
  hotel: 'Accommodation',
  rent: 'Utilities',
  electricity: 'Utilities',
  medical: 'Health',
  medicine: 'Health',
};

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeConfidence(value: unknown): ConfidenceScores {
  const defaults: ConfidenceScores = {
    payer: 0.5,
    amount: 0.5,
    participants: 0.5,
    split_type: 0.5,
  };
  if (!value || typeof value !== 'object') return defaults;

  const source = value as Record<string, unknown>;
  const keys = ['payer', 'amount', 'participants', 'split_type'] as const;

  return keys.reduce((acc, key) => {
    let score = source[key];
    if (typeof score === 'string') score = Number.parseFloat(score);
    if (typeof score === 'number' && Number.isFinite(score)) {
      acc[key] = Math.min(1, Math.max(0, score > 1 ? score / 100 : score));
    }
    return acc;
  }, { ...defaults });
}

function normalizeCategory(value: unknown): ExpenseCategory {
  if (typeof value !== 'string' || !value.trim()) return 'Other';

  const trimmed = value.trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as ExpenseCategory;
  }

  const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const lower = trimmed.toLowerCase();
  if (/food|grocery|restaurant|meal|dinner|lunch|breakfast|cafe/.test(lower)) return 'Food';
  if (/transport|taxi|uber|cab|fuel|petrol|flight|train|bus/.test(lower)) return 'Transport';
  if (/hotel|stay|accommodation|airbnb/.test(lower)) return 'Accommodation';
  if (/movie|game|entertainment|concert/.test(lower)) return 'Entertainment';
  if (/bill|utility|electric|water|internet|rent/.test(lower)) return 'Utilities';
  if (/shop|amazon|store|mall/.test(lower)) return 'Shopping';
  if (/doctor|medic|health|pharmacy|hospital/.test(lower)) return 'Health';

  return 'Other';
}

function normalizeSplitType(value: unknown): (typeof SPLIT_TYPES)[number] {
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if ((SPLIT_TYPES as readonly string[]).includes(lower)) {
      return lower as (typeof SPLIT_TYPES)[number];
    }
    if (lower.includes('equal') || lower.includes('even')) return 'equal';
    if (lower.includes('percent')) return 'percentage';
    if (lower.includes('share')) return 'shares';
    if (lower.includes('exact') || lower.includes('amount')) return 'exact';
  }
  return 'equal';
}

function normalizeSplitValues(value: unknown): Record<string, number | string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, number | string>;
  }
  return null;
}

function unwrapExpensePayload(parsed: unknown): Record<string, unknown> {
  if (Array.isArray(parsed)) {
    throw new Error('AI response must be a single JSON object, not an array');
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.expenses)) {
      throw new Error('AI response must be a single expense object, not an expenses list');
    }
    if (obj.expense && typeof obj.expense === 'object' && !Array.isArray(obj.expense)) {
      return obj.expense as Record<string, unknown>;
    }
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>;
    }
    return obj;
  }

  throw new Error('AI response is not a JSON object');
}

export function normalizeExpenseCandidate(raw: unknown): Record<string, unknown> {
  const source = unwrapExpensePayload(raw);
  const ambiguities = Array.isArray(source.ambiguities)
    ? source.ambiguities.filter((a): a is string => typeof a === 'string')
    : [];

  const participants = Array.isArray(source.participants)
    ? source.participants.filter((p): p is string => typeof p === 'string')
    : typeof source.participants === 'string'
      ? [source.participants]
      : [];

  const currencyRaw = typeof source.currency === 'string' ? source.currency.toUpperCase().trim() : 'USD';
  const description =
    typeof source.description === 'string' && source.description.trim()
      ? source.description.trim()
      : 'Expense';

  const lineItems = Array.isArray(source.line_items)
    ? source.line_items
    : Array.isArray((source as { items?: unknown }).items)
      ? (source as { items: unknown[] }).items
      : null;

  return {
    payer: typeof source.payer === 'string' ? source.payer : source.payer === null ? null : null,
    amount: coerceNumber(source.amount),
    currency: currencyRaw.length >= 3 ? currencyRaw.slice(0, 3) : 'USD',
    date: typeof source.date === 'string' ? source.date : source.date === null ? null : null,
    description,
    category: normalizeCategory(source.category),
    participants,
    split_type: normalizeSplitType(source.split_type),
    split_values: normalizeSplitValues(source.split_values),
    group_hint: typeof source.group_hint === 'string' ? source.group_hint : source.group_hint === null ? null : null,
    confidence: normalizeConfidence(source.confidence),
    ambiguities,
    line_items: lineItems,
  };
}

/**
 * Deterministically compute expense totals from AI-provided structured line items.
 * The LLM only describes each line (amount + how it's shared); ALL arithmetic happens here,
 * so multi-item splits are always correct regardless of phrasing.
 */
export interface LineItemSplitResult {
  amount: number;
  split_type: (typeof SPLIT_TYPES)[number];
  split_values: Record<string, number> | null;
  participants: string[];
  payer: string | null;
  description: string;
}

const EQUAL_KEYWORDS = new Set([
  'shared',
  'share',
  'equal',
  'equally',
  'all',
  'everyone',
  'everybody',
  'split',
  'evenly',
  'even',
  'together',
  'both',
  'us',
]);

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function splitEqualCents(totalCents: number, names: string[]): Map<string, number> {
  const result = new Map<string, number>();
  if (names.length === 0) return result;
  const base = Math.floor(totalCents / names.length);
  let remainder = totalCents - base * names.length;
  for (const name of names) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result.set(name, (result.get(name) ?? 0) + base + extra);
  }
  return result;
}

function resolveLineName(
  raw: string,
  memberNames: string[],
  speakerName?: string,
): string {
  const normalized = raw.toLowerCase().trim();
  if (!normalized) return raw;
  if ((normalized === 'me' || normalized === 'i' || normalized === 'you' || normalized === 'myself') && speakerName) {
    return speakerName;
  }

  const exact = memberNames.find((m) => m.toLowerCase() === normalized);
  if (exact) return exact;

  const firstNameMatches = memberNames.filter((m) => (m.split(/\s+/)[0] ?? '').toLowerCase() === normalized);
  if (firstNameMatches.length === 1) return firstNameMatches[0];

  const prefixMatches = memberNames.filter((m) => m.toLowerCase().startsWith(normalized));
  if (prefixMatches.length === 1) return prefixMatches[0];

  if (normalized.length === 1) {
    const initialMatches = memberNames.filter((m) => (m[0] ?? '').toLowerCase() === normalized);
    if (initialMatches.length === 1) return initialMatches[0];
  }

  return raw;
}

interface InterpretedLine {
  amountCents: number;
  shares: Map<string, number>;
  label: string;
  paidBy: string | null;
}

function interpretLineSplit(
  split: unknown,
  amountCents: number,
  memberNames: string[],
  speakerName?: string,
): { shares: Map<string, number>; label: string } {
  // Equal among all members (string keyword or missing)
  const equalAll = () => ({
    shares: splitEqualCents(amountCents, memberNames),
    label: 'shared',
  });

  if (split === null || split === undefined) return equalAll();

  if (typeof split === 'string') {
    const lower = split.toLowerCase().trim();
    if (EQUAL_KEYWORDS.has(lower)) return equalAll();
    // single name → full amount to that member
    const name = resolveLineName(split, memberNames, speakerName);
    return { shares: new Map([[name, amountCents]]), label: `${name} only` };
  }

  if (Array.isArray(split)) {
    const names = split
      .filter((s): s is string => typeof s === 'string')
      .map((s) => resolveLineName(s, memberNames, speakerName));
    if (names.length === 0) return equalAll();
    if (names.length === 1) return { shares: new Map([[names[0], amountCents]]), label: `${names[0]} only` };
    return { shares: splitEqualCents(amountCents, names), label: `split: ${names.join(', ')}` };
  }

  if (typeof split === 'object') {
    const obj = split as Record<string, unknown>;

    // structured forms
    if (typeof obj.only === 'string') {
      const name = resolveLineName(obj.only, memberNames, speakerName);
      return { shares: new Map([[name, amountCents]]), label: `${name} only` };
    }

    const typeStr = typeof obj.type === 'string' ? obj.type.toLowerCase() : '';
    const amountsSource =
      obj.values && typeof obj.values === 'object'
        ? (obj.values as Record<string, unknown>)
        : obj.amounts && typeof obj.amounts === 'object'
          ? (obj.amounts as Record<string, unknown>)
          : null;

    if ((typeStr === 'equal' || typeStr === 'shared') && !amountsSource) {
      const among = Array.isArray(obj.among)
        ? obj.among.filter((s): s is string => typeof s === 'string').map((s) => resolveLineName(s, memberNames, speakerName))
        : memberNames;
      const names = among.length > 0 ? among : memberNames;
      const label = names.length === memberNames.length ? 'shared' : `split: ${names.join(', ')}`;
      return { shares: splitEqualCents(amountCents, names), label };
    }

    const map = amountsSource ?? obj;
    const numericEntries: { name: string; num: number }[] = [];
    for (const [key, value] of Object.entries(map)) {
      if (key === 'type' || key === 'among' || key === 'only' || key === 'values' || key === 'amounts') continue;
      const num = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(num)) continue;
      numericEntries.push({ name: resolveLineName(key, memberNames, speakerName), num });
    }

    if (numericEntries.length === 0) return equalAll();

    // Percentage split: explicit type, or values that look like percentages summing to ~100.
    const pctSum = numericEntries.reduce((s, e) => s + e.num, 0);
    const looksLikePercent =
      typeStr === 'percentage' ||
      typeStr === 'percent' ||
      (numericEntries.length >= 2 &&
        Math.abs(pctSum - 100) <= 1 &&
        numericEntries.every((e) => e.num >= 0 && e.num <= 100) &&
        pctSum * 100 !== amountCents);

    if (looksLikePercent) {
      return applyPercentageSplit(numericEntries, amountCents);
    }

    // Exact per-person amounts.
    const shares = new Map<string, number>();
    const labelParts: string[] = [];
    for (const { name, num } of numericEntries) {
      shares.set(name, (shares.get(name) ?? 0) + toCents(num));
      labelParts.push(`${name}:${num}`);
    }
    if (shares.size === 1) {
      const only = [...shares.keys()][0];
      return { shares, label: `${only} only` };
    }
    return { shares, label: labelParts.join(' ') };
  }

  return equalAll();
}

/** Distribute amountCents by percentage, giving any rounding remainder to the last person. */
function applyPercentageSplit(
  entries: { name: string; num: number }[],
  amountCents: number,
): { shares: Map<string, number>; label: string } {
  const shares = new Map<string, number>();
  const labelParts: string[] = [];
  let allocated = 0;
  for (let i = 0; i < entries.length; i++) {
    const { name, num } = entries[i];
    const isLast = i === entries.length - 1;
    const cents = isLast ? amountCents - allocated : Math.round((amountCents * num) / 100);
    allocated += cents;
    shares.set(name, (shares.get(name) ?? 0) + cents);
    labelParts.push(`${name}:${num}%`);
  }
  return { shares, label: labelParts.join(' ') };
}

export function buildExpenseFromLineItems(
  rawLineItems: unknown,
  options: { memberNames: string[]; speakerName?: string },
): LineItemSplitResult | null {
  if (!Array.isArray(rawLineItems) || rawLineItems.length === 0) return null;
  const { memberNames, speakerName } = options;
  if (memberNames.length === 0) return null;

  const lines: InterpretedLine[] = [];

  for (const raw of rawLineItems) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const amount = coerceNumber(item.amount ?? item.cost ?? item.price);
    if (amount === null || amount === 0) continue;

    const amountCents = toCents(amount);
    const descRaw =
      typeof item.item === 'string'
        ? item.item
        : typeof item.description === 'string'
          ? item.description
          : typeof item.name === 'string'
            ? item.name
            : 'Item';

    const paidByRaw =
      typeof item.paid_by === 'string'
        ? item.paid_by
        : typeof item.payer === 'string'
          ? item.payer
          : typeof item.paidBy === 'string'
            ? item.paidBy
            : null;
    const paidBy = paidByRaw ? resolveLineName(paidByRaw, memberNames, speakerName) : null;

    const splitSpec =
      item.split !== undefined
        ? item.split
        : item.split_values !== undefined
          ? item.split_values
          : item.shares !== undefined
            ? item.shares
            : item.for !== undefined
              ? item.for
              : null;

    // Credits/discounts use a negative amount: the credited person owes |amount| less,
    // and the remaining members absorb it equally so the shares still sum to total spend.
    const isCredit = amountCents < 0;
    const { shares: rawShares, label: rawLabel } = interpretLineSplit(
      splitSpec,
      Math.abs(amountCents),
      memberNames,
      speakerName,
    );

    let shares = rawShares;
    let label = rawLabel;
    if (isCredit) {
      const credited = [...rawShares.keys()];
      const others = memberNames.filter((m) => !credited.includes(m));
      shares = new Map();
      for (const [name, cents] of rawShares) shares.set(name, -cents);
      if (others.length > 0) {
        const creditTotal = [...rawShares.values()].reduce((s, c) => s + c, 0);
        const perPerson = splitEqualCents(creditTotal, others);
        for (const [name, cents] of perPerson) {
          shares.set(name, (shares.get(name) ?? 0) + cents);
        }
      }
      label = `credit ${rawLabel}`;
    }

    lines.push({
      amountCents,
      shares,
      paidBy,
      label: `${descRaw.trim()} ${amount} (${label})`,
    });
  }

  if (lines.length === 0) return null;

  const totals = new Map<string, number>();
  const paidTotals = new Map<string, number>();
  let totalCents = 0;

  for (const line of lines) {
    if (line.amountCents > 0) totalCents += line.amountCents;
    for (const [name, cents] of line.shares) {
      totals.set(name, (totals.get(name) ?? 0) + cents);
    }
    if (line.paidBy && line.amountCents > 0) {
      paidTotals.set(line.paidBy, (paidTotals.get(line.paidBy) ?? 0) + line.amountCents);
    }
  }

  const splitValues: Record<string, number> = {};
  for (const [name, cents] of totals) {
    if (cents !== 0) splitValues[name] = Math.round(cents) / 100;
  }

  const participants = Object.keys(splitValues);
  const amount = Math.round(totalCents) / 100;

  // payer = member who paid the most across lines (fallback to speaker)
  let payer: string | null = null;
  let maxPaid = -1;
  for (const [name, cents] of paidTotals) {
    if (cents > maxPaid) {
      maxPaid = cents;
      payer = name;
    }
  }
  if (!payer && speakerName) payer = speakerName;
  const payerField = payer && speakerName && payer === speakerName ? 'You' : payer;

  // Single equal-among-all line → clean equal split
  const isSingleEqual =
    lines.length === 1 &&
    lines[0].shares.size === memberNames.length &&
    new Set([...lines[0].shares.values()]).size <= 1;

  if (isSingleEqual) {
    return {
      amount,
      split_type: 'equal',
      split_values: null,
      participants,
      payer: payerField,
      description: lines[0].label.replace(/\(shared\)$/, `— split equally among ${memberNames.join(', ')}`),
    };
  }

  const totalsLabel = participants.map((name) => `${name}: ${splitValues[name]}`).join(', ');
  const description = `${lines.map((l) => l.label).join(' | ')} → ${totalsLabel}`;

  return {
    amount,
    split_type: 'exact',
    split_values: splitValues,
    participants,
    payer: payerField,
    description,
  };
}

export function getLowConfidenceFields(confidence: ConfidenceScores): string[] {
  return (Object.entries(confidence) as [keyof ConfidenceScores, number][])
    .filter(([, score]) => score < CONFIDENCE_THRESHOLD)
    .map(([field]) => field);
}

export function parseExpenseJson(raw: string): ParsedExpense {
  const parsed = parseExpenseJsonLoose(raw);
  return parsedExpenseSchema.parse(normalizeExpenseCandidate(parsed));
}

/** Parse AI JSON tolerantly: strip fences, isolate the object, fix trailing commas, repair truncation. */
export function parseExpenseJsonLoose(raw: string): unknown {
  const blob = extractJsonBlob(raw);
  const attempts = [
    blob,
    blob.replace(/,\s*([}\]])/g, '$1'),
    repairTruncatedJson(blob),
    repairTruncatedJson(blob.replace(/,\s*([}\]])/g, '$1')),
  ];

  let lastError: Error | null = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('AI response is not valid JSON');
}

/** Isolate the outermost JSON object, tracking strings so braces inside text don't confuse us. */
function extractJsonBlob(raw: string): string {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // If the payload already starts with a bracket, return as-is (lets array inputs be rejected downstream).
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) return cleaned;

  const start = cleaned.indexOf('{');
  if (start === -1) return cleaned;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return cleaned.slice(start);
}

/** Best-effort repair of JSON truncated by an output-token limit (drops the trailing partial item, closes braces). */
function repairTruncatedJson(input: string): string {
  let text = input.trimEnd();
  if (text.endsWith(',')) text = text.slice(0, -1);

  // Walk to find unbalanced brackets while ignoring string contents.
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSafeIndex = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
    if (stack.length <= 2 && (ch === '}' || ch === ']')) lastSafeIndex = i;
  }

  // If we ended mid-string or mid-object, cut back to the last balanced point inside the array.
  if (inString || stack.length > 0) {
    if (lastSafeIndex > 0) text = text.slice(0, lastSafeIndex + 1);
  }
  text = text.trimEnd();
  if (text.endsWith(',')) text = text.slice(0, -1);

  // Recompute open brackets and close them.
  const closers: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') closers.pop();
  }
  return text + closers.reverse().join('');
}
