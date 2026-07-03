import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityKind = 'expense' | 'settlement' | 'member';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  date: string;
  groupId: string | null;
  groupName: string | null;
  title: string;
  subtitle: string;
  category: string | null;
  amount: number;
  currency: string;
  userShare: number;
  userPaid: boolean;
  /** Raw expense/settlement ID for navigation (strips the 'expense:'/'settlement:' prefix) */
  sourceId: string;
  /** For audit items: action taken and diff details */
  action?: string;
  diff?: Record<string, [unknown, unknown]>;
}

export interface ActivityQuery {
  q?: string;
  groupId?: string;
  type?: ActivityKind | 'all';
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async feed(userId: string, query: ActivityQuery) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const page = Math.max(query.page ?? 0, 0);
    const fetchUpTo = (page + 1) * limit + 1; // +1 to detect "hasMore"
    const q = query.q?.trim();
    const type = query.type ?? 'all';

    const wantExpenses = type === 'all' || type === 'expense';
    const wantSettlements = type === 'all' || type === 'settlement';
    const wantMembers = type === 'all' || type === 'member';

    const expenses = wantExpenses ? await this.fetchExpenses(userId, query.groupId, q, fetchUpTo) : [];
    const settlements = wantSettlements ? await this.fetchSettlements(userId, query.groupId, q, fetchUpTo) : [];
    const memberEvents = wantMembers ? await this.fetchMemberEvents(userId, query.groupId, q, fetchUpTo) : [];

    const merged = [...expenses, ...settlements, ...memberEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const start = page * limit;
    const items = merged.slice(start, start + limit);
    const hasMore = merged.length > start + limit;

    return { items, page, hasMore };
  }

  /** Expense activity from immutable audit logs — each create/update/delete is its own row. */
  private async fetchExpenses(
    userId: string,
    groupId: string | undefined,
    q: string | undefined,
    take: number,
  ): Promise<ActivityItem[]> {
    const where: Prisma.ExpenseAuditLogWhereInput = {
      group: { deletedAt: null, members: { some: { userId } } },
      ...(groupId ? { groupId } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { actor: { name: { contains: q, mode: 'insensitive' } } },
              { group: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const logs = await this.prisma.expenseAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        group: { select: { name: true, currency: true } },
        actor: { select: { id: true, name: true } },
        expense: {
          select: {
            currency: true,
            splits: { where: { userId }, select: { amount: true } },
          },
        },
      },
    });

    const payerIds = [...new Set(logs.map((l) => l.paidById).filter((id): id is string => !!id))];
    const payers = payerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: payerIds } },
          select: { id: true, name: true },
        })
      : [];
    const payerNames = new Map(payers.map((p) => [p.id, p.name]));

    return logs.map((log) => {
      const amount = log.amount?.toNumber() ?? 0;
      const currency = log.expense?.currency ?? log.group.currency ?? 'USD';
      const userPaid = log.paidById === userId;
      const payerName = log.paidById ? payerNames.get(log.paidById) : undefined;
      const actorLabel = log.actor.id === userId ? 'You' : log.actor.name;
      const actionVerb =
        log.action === 'created' ? 'added' : log.action === 'updated' ? 'updated' : 'deleted';

      return {
        id: `audit:${log.id}`,
        sourceId: log.expenseId,
        kind: 'expense' as const,
        date: log.createdAt.toISOString(),
        groupId: log.groupId,
        groupName: log.group.name,
        title: log.description ?? 'Expense',
        subtitle: payerName
          ? `${log.group.name} · ${actorLabel} ${actionVerb} · paid by ${payerName}`
          : `${log.group.name} · ${actorLabel} ${actionVerb}`,
        category: log.category,
        amount,
        currency,
        userShare: log.expense?.splits[0]?.amount.toNumber() ?? 0,
        userPaid,
        action: log.action,
        diff: log.diff as Record<string, [unknown, unknown]> | undefined,
      };
    });
  }

  private async fetchSettlements(
    userId: string,
    groupId: string | undefined,
    q: string | undefined,
    take: number,
  ): Promise<ActivityItem[]> {
    const where: Prisma.SettlementWhereInput = {
      OR: [{ payerId: userId }, { payeeId: userId }],
      ...(groupId ? { groupId } : {}),
    };

    const settlements = await this.prisma.settlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    });

    // Settlement has no Group relation; resolve group names in one batch.
    const groupIds = [...new Set(settlements.map((s) => s.groupId).filter((g): g is string => !!g))];
    const groupNames = new Map<string, string>();
    if (groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      });
      for (const g of groups) groupNames.set(g.id, g.name);
    }

    const mapped = settlements.map((s) => {
      const isPayer = s.payerId === userId;
      const title = isPayer ? `You paid ${s.payee.name}` : `${s.payer.name} paid you`;
      const groupName = s.groupId ? groupNames.get(s.groupId) ?? null : null;
      return {
        id: `settlement:${s.id}`,
        sourceId: s.id,
        kind: 'settlement' as const,
        date: s.createdAt.toISOString(),
        groupId: s.groupId,
        groupName,
        title,
        subtitle: s.note ?? (groupName ? `${groupName} · settlement` : 'Settlement'),
        category: null,
        amount: s.amount.toNumber(),
        currency: s.currency,
        userShare: s.amount.toNumber(),
        userPaid: isPayer,
      };
    });

    // Settlements aren't searchable in SQL above (note/names), so filter in-memory when q is set.
    if (!q) return mapped;
    const needle = q.toLowerCase();
    return mapped.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.subtitle.toLowerCase().includes(needle),
    );
  }

  /** Derive "joined group" / "created group" audit events from group memberships (no extra table). */
  private async fetchMemberEvents(
    userId: string,
    groupId: string | undefined,
    q: string | undefined,
    take: number,
  ): Promise<ActivityItem[]> {
    const myGroups = await this.prisma.groupMember.findMany({
      where: { userId, group: { deletedAt: null }, ...(groupId ? { groupId } : {}) },
      select: { groupId: true },
    });
    const groupIds = myGroups.map((g) => g.groupId);
    if (groupIds.length === 0) return [];

    const joins = await this.prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, group: { deletedAt: null } },
      orderBy: { joinedAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, createdBy: true } },
      },
    });

    const mapped = joins.map((m) => {
      const isCreator = m.userId === m.group.createdBy;
      const who = m.userId === userId ? 'You' : m.user.name;
      return {
        id: `member:${m.id}`,
        sourceId: m.groupId,
        kind: 'member' as const,
        date: m.joinedAt.toISOString(),
        groupId: m.groupId,
        groupName: m.group.name,
        title: `${who} ${isCreator ? 'created' : 'joined'} ${m.group.name}`,
        subtitle: isCreator ? 'Group created' : 'Member joined',
        category: null,
        amount: 0,
        currency: '',
        userShare: 0,
        userPaid: false,
      };
    });

    if (!q) return mapped;
    const needle = q.toLowerCase();
    return mapped.filter((m) => m.title.toLowerCase().includes(needle));
  }
}
