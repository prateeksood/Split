import { describe, it, expect } from 'vitest';
import { calculateBalances, sumBalances, applySettlements } from './balances';
import { simplifyDebts, computeEqualSplits, computePairwiseDebts, buildMemberDebtSummaries } from './debt-simplification';
import { parseExpenseJson, normalizeExpenseCandidate, buildExpenseFromLineItems, parseExpenseJsonLoose } from '../schemas/expense-parse';
import { validateParsedParticipants, canonicalizeParsedExpenseNames, validateParsedSplitTotals } from './expense-builder';

describe('calculateBalances', () => {
  it('computes net balances from splits', () => {
    const balances = calculateBalances([
      { userId: 'a', amount: 50, paid: 100 },
      { userId: 'b', amount: 50, paid: 0 },
    ]);

    expect(balances.get('a')).toBe(50);
    expect(balances.get('b')).toBe(-50);
    expect(sumBalances(balances)).toBe(0);
  });

  it('handles three-way equal split', () => {
    const splits = computeEqualSplits(100, ['a', 'b', 'c']);
    const expenses = [
      { userId: 'a', amount: splits.get('a')!, paid: 100 },
      { userId: 'b', amount: splits.get('b')!, paid: 0 },
      { userId: 'c', amount: splits.get('c')!, paid: 0 },
    ];

    const balances = calculateBalances(expenses);
    expect(sumBalances(balances)).toBe(0);
    expect(balances.get('a')).toBeGreaterThan(0);
    expect(balances.get('b')).toBeLessThan(0);
    expect(balances.get('c')).toBeLessThan(0);
  });
});

describe('applySettlements', () => {
  it('zeroes out a debt once it is paid', () => {
    // a paid for b: b owes a 50 → a:+50, b:-50
    const balances = calculateBalances([
      { userId: 'a', amount: 50, paid: 100 },
      { userId: 'b', amount: 50, paid: 0 },
    ]);
    // b pays a 50
    applySettlements(balances, [{ payerId: 'b', payeeId: 'a', amount: 50 }]);
    expect(balances.get('a')).toBe(0);
    expect(balances.get('b')).toBe(0);
    expect(sumBalances(balances)).toBe(0);
  });

  it('partially reduces a debt and preserves zero-sum', () => {
    const balances = new Map([
      ['a', 100],
      ['b', -100],
    ]);
    applySettlements(balances, [{ payerId: 'b', payeeId: 'a', amount: 30 }]);
    expect(balances.get('a')).toBe(70);
    expect(balances.get('b')).toBe(-70);
    expect(sumBalances(balances)).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('minimizes transactions for simple debt', () => {
    const balances = new Map([
      ['alice', 60],
      ['bob', -60],
    ]);

    const debts = simplifyDebts(balances);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toEqual({ payerId: 'bob', payeeId: 'alice', amount: 60 });
  });

  it('simplifies complex multi-party debts', () => {
    const balances = new Map([
      ['a', 100],
      ['b', 50],
      ['c', -90],
      ['d', -60],
    ]);

    const debts = simplifyDebts(balances);
    const total = debts.reduce((s, d) => s + d.amount, 0);
    expect(total).toBe(150);
    expect(debts.length).toBeLessThanOrEqual(3);
  });
});

describe('parseExpenseJson', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      payer: 'You',
      amount: 1200,
      currency: 'INR',
      date: 'today',
      description: 'Dinner',
      category: 'Food',
      participants: ['You', 'Rahul', 'Priya'],
      split_type: 'equal',
      split_values: null,
      group_hint: 'Goa Trip',
      confidence: { payer: 0.9, amount: 0.95, participants: 0.8, split_type: 1 },
      ambiguities: [],
    });

    const result = parseExpenseJson(raw);
    expect(result.amount).toBe(1200);
    expect(result.participants).toHaveLength(3);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"payer":"You","amount":500,"currency":"USD","date":null,"description":"Pizza","category":"Food","participants":["You","Bob"],"split_type":"equal","split_values":null,"group_hint":null,"confidence":{"payer":0.9,"amount":0.9,"participants":0.9,"split_type":1},"ambiguities":[]}\n```';
    const result = parseExpenseJson(raw);
    expect(result.amount).toBe(500);
  });

  it('rejects JSON array responses', () => {
    const raw = JSON.stringify([
      { payer: 'You', amount: 500, currency: 'INR', description: 'A', category: 'Food', participants: ['You'], split_type: 'equal', split_values: null, group_hint: null, confidence: { payer: 0.9, amount: 0.9, participants: 0.9, split_type: 1 }, ambiguities: [] },
    ]);
    expect(() => parseExpenseJson(raw)).toThrow(/single JSON object/i);
  });

  it('accepts pre-combined exact split from AI', () => {
    const raw = JSON.stringify({
      payer: 'You',
      amount: 580,
      currency: 'INR',
      description: 'Coke 80 (John only) | Rice 200 (all) | Dal 300 (all) → John: 330, Prateek Sood: 250',
      category: 'Food',
      participants: ['John', 'Prateek Sood'],
      split_type: 'exact',
      split_values: { John: 330, 'Prateek Sood': 250 },
      group_hint: null,
      confidence: { payer: 0.9, amount: 1, participants: 0.95, split_type: 1 },
      ambiguities: [],
    });

    const result = parseExpenseJson(raw);
    expect(result.description).toContain('John');
    expect(result.split_values).toEqual({ John: 330, 'Prateek Sood': 250 });
  });

  it('normalizes grocery category and string amounts', () => {
    const normalized = normalizeExpenseCandidate({
      payer: 'You',
      amount: '500',
      currency: 'inr',
      description: 'Groceries',
      category: 'groceries',
      participants: 'Rahul Sharma',
      split_type: 'equal',
      confidence: { payer: '0.8', amount: 85, participants: 0.7, split_type: 1 },
    });

    expect(normalized.category).toBe('Food');
    expect(normalized.amount).toBe(500);
    expect(normalized.currency).toBe('INR');
    expect(normalized.participants).toEqual(['Rahul Sharma']);
    expect(normalized.confidence).toEqual({
      payer: 0.8,
      amount: 0.85,
      participants: 0.7,
      split_type: 1,
    });
  });
});

describe('computePairwiseDebts', () => {
  it('tracks who owes whom from expenses', () => {
    const debts = computePairwiseDebts([
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amount: 50 },
          { userId: 'bob', amount: 50 },
        ],
      },
    ]);

    expect(debts).toEqual([{ fromId: 'bob', toId: 'alice', amount: 50 }]);
  });
});

describe('validateParsedParticipants', () => {
  const members = [
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
  ];

  it('flags unknown participants', () => {
    const result = validateParsedParticipants(
      { participants: ['Alice', 'Charlie'], payer: 'Alice' },
      members,
      { id: 'a', name: 'Alice' },
    );
    expect(result.unknownParticipants).toEqual(['Charlie']);
  });
});

describe('canonicalizeParsedExpenseNames', () => {
  const members = [
    { id: 'p', name: 'Prateek' },
    { id: 'j', name: 'John' },
  ];

  it('maps first-name keys to exact member names', () => {
    const result = canonicalizeParsedExpenseNames(
      {
        participants: ['prateek', 'John'],
        payer: 'You',
        split_values: { prateek: 230, John: 150 },
      },
      members,
      { id: 'p', name: 'Prateek' },
    );
    expect(result.split_values).toEqual({ Prateek: 230, John: 150 });
    expect(result.participants).toEqual(['Prateek', 'John']);
  });
});

describe('buildExpenseFromLineItems', () => {
  const members = ['Prateek Sood', 'John'];

  it('computes the multi-payer ledger correctly', () => {
    const result = buildExpenseFromLineItems(
      [
        { item: 'Brunch', amount: 1200, paid_by: 'John', split: 'shared' },
        { item: 'Parking', amount: 450, paid_by: 'John', split: ['John'] },
        { item: 'Cab', amount: 900, paid_by: 'John', split: { 'Prateek Sood': 700, John: 200 } },
        { item: 'Drinks', amount: 300, paid_by: 'John', split: 'shared' },
        { item: 'Shopping', amount: 1700, paid_by: 'Prateek Sood', split: ['Prateek Sood'] },
        { item: 'Resort', amount: 1300, paid_by: 'Prateek Sood', split: { 'Prateek Sood': 800, John: 500 } },
        { item: 'Snacks', amount: 550, paid_by: 'Prateek Sood', split: 'shared' },
      ],
      { memberNames: members, speakerName: 'Prateek Sood' },
    );

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(6400);
    expect(result!.split_type).toBe('exact');
    expect(result!.split_values).toEqual({ 'Prateek Sood': 4225, John: 2175 });
    const sum = Object.values(result!.split_values!).reduce((s, v) => s + v, 0);
    expect(sum).toBe(6400);
  });

  it('resolves initials and "shared" keyword', () => {
    const result = buildExpenseFromLineItems(
      [
        { item: 'Dinner', amount: 1800, paid_by: 'P', split: 'shared' },
        { item: 'Breakfast', amount: 600, paid_by: 'J', split: { P: 200, J: 400 } },
        { item: 'Coffee', amount: 300, paid_by: 'P', split: ['P'] },
      ],
      { memberNames: members, speakerName: 'Prateek Sood' },
    );

    expect(result!.amount).toBe(2700);
    expect(result!.split_values).toEqual({ 'Prateek Sood': 1400, John: 1300 });
  });

  it('returns a clean equal split for a single shared line', () => {
    const result = buildExpenseFromLineItems(
      [{ item: 'Dinner', amount: 500, paid_by: 'Prateek Sood', split: 'shared' }],
      { memberNames: members, speakerName: 'Prateek Sood' },
    );

    expect(result!.split_type).toBe('equal');
    expect(result!.split_values).toBeNull();
    expect(result!.payer).toBe('You');
  });

  it('returns null when there are no usable line items', () => {
    expect(buildExpenseFromLineItems([], { memberNames: members })).toBeNull();
    expect(buildExpenseFromLineItems(null, { memberNames: members })).toBeNull();
  });

  it('handles percentage splits, credits, and treats (trek scenario)', () => {
    const result = buildExpenseFromLineItems(
      [
        { item: 'Hotel 3 nights', amount: 2700, paid_by: 'John', split: 'shared' },
        { item: 'Hotel 2 nights treat', amount: 1800, paid_by: 'John', split: ['John'] },
        { item: 'Transport', amount: 2200, paid_by: 'Prateek Sood', split: 'shared' },
        { item: 'Fuel credit', amount: -300, paid_by: null, split: ['John'] },
        { item: 'Breakfast', amount: 1200, paid_by: 'John', split: 'shared' },
        { item: 'Lunch', amount: 1200, paid_by: 'John', split: { type: 'percentage', John: 60, 'Prateek Sood': 40 } },
        { item: 'Dinner', amount: 1200, paid_by: 'John', split: 'shared' },
        { item: 'Gear rental', amount: 800, paid_by: 'Prateek Sood', split: 'shared' },
        { item: 'Guide fees', amount: 1500, paid_by: 'John', split: 'shared' },
        { item: 'Entry tickets', amount: 600, paid_by: 'Prateek Sood', split: 'shared' },
        { item: 'Guide tip', amount: 200, paid_by: 'John', split: ['John'] },
      ],
      { memberNames: members, speakerName: 'Prateek Sood' },
    );

    // Total spend = 4500 hotel + 2200 transport + 3600 meals + 800 gear + 1500 guide + 600 tickets + 200 tip.
    expect(result!.amount).toBe(13400);
    const sum = Object.values(result!.split_values!).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(13400, 2);
    // Fuel credit shifts ₹300 from John to Prateek; lunch is 60/40 to John.
    expect(result!.split_values!['Prateek Sood']).toBeCloseTo(5880, 2);
    expect(result!.split_values!.John).toBeCloseTo(7520, 2);
  });

  it('recovers truncated JSON from a token-capped response', () => {
    const truncated =
      '{"currency":"INR","category":"Food","date":null,"group_hint":null,"ambiguities":[],"line_items":[{"item":"Brunch","amount":1200,"paid_by":"John","split":"shared"},{"item":"Cab","amount":900,"paid_by":"John","spl';
    const parsed = parseExpenseJsonLoose(truncated) as { line_items: unknown[] };
    expect(Array.isArray(parsed.line_items)).toBe(true);
    expect(parsed.line_items.length).toBeGreaterThanOrEqual(1);
  });

  it('parses JSON with trailing commas', () => {
    const raw =
      '{"currency":"INR","category":"Food","date":null,"group_hint":null,"ambiguities":[],"line_items":[{"item":"Dinner","amount":500,"paid_by":"Prateek","split":"shared",},],}';
    const parsed = parseExpenseJsonLoose(raw) as { currency: string };
    expect(parsed.currency).toBe('INR');
  });
});

describe('validateParsedSplitTotals', () => {
  it('passes when exact splits sum to amount', () => {
    expect(
      validateParsedSplitTotals({
        amount: 6800,
        split_type: 'exact',
        split_values: { 'Prateek Sood': 3350, John: 3450 },
      }),
    ).toBeNull();
  });

  it('fails when exact splits do not sum to amount', () => {
    expect(
      validateParsedSplitTotals({
        amount: 6800,
        split_type: 'exact',
        split_values: { 'Prateek Sood': 3100, John: 4300 },
      }),
    ).toContain('6800');
  });
});
