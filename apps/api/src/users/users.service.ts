import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { calculateBalances, applySettlements, updateProfileSchema, type SettlementEntry } from '@split/shared';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class UsersService {
  private readonly adminEmails: Set<string>;

  constructor(
    private prisma: PrismaService,
    private currency: CurrencyService,
    private config: ConfigService,
  ) {
    const raw = this.config.get<string>('ADMIN_EMAILS') ?? '';
    this.adminEmails = new Set(
      raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        defaultCurrency: true,
        createdAt: true,
      },
    });
    return { ...user, isAdmin: this.adminEmails.has(user.email.toLowerCase()) };
  }

  async getDashboard(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { deletedAt: null } },
      include: {
        group: {
          include: {
            expenses: {
              where: { deletedAt: null },
              include: { splits: true },
            },
          },
        },
      },
    });

    const settlementMap = await this.getGroupSettlements(memberships.map((m) => m.group.id));

    const groups = memberships.map((m) => {
      const splits = m.group.expenses.flatMap((e) =>
        e.splits.map((s) => ({
          userId: s.userId,
          amount: s.amount.toNumber(),
          paid: e.paidById === s.userId ? e.amount.toNumber() : 0,
        })),
      );
      const balances = applySettlements(calculateBalances(splits), settlementMap.get(m.group.id) ?? []);
      const balance = Math.round((balances.get(userId) ?? 0) * 100) / 100;

      return {
        id: m.group.id,
        name: m.group.name,
        color: m.group.color,
        currency: m.group.currency,
        balance,
      };
    });

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true },
    });
    const defaultCurrency = profile?.defaultCurrency ?? 'USD';
    const totalBalance = await this.sumInDefaultCurrency(groups, defaultCurrency);

    const recentExpenses = await this.prisma.expense.findMany({
      where: {
        deletedAt: null,
        group: { members: { some: { userId } } },
      },
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        group: { select: { name: true } },
        paidBy: { select: { name: true } },
        splits: { where: { userId } },
      },
    });

    return {
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalCurrency: defaultCurrency,
      groups,
      recentActivity: recentExpenses.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        description: e.description,
        category: e.category,
        amount: e.amount.toNumber(),
        currency: e.currency,
        groupName: e.group.name,
        paidByName: e.paidBy.name,
        date: e.date,
        userShare: e.splits[0]?.amount.toNumber() ?? 0,
        userPaid: e.paidById === userId,
      })),
    };
  }

  /**
   * Sum group balances into the user's default currency, converting each group's
   * balance from its own currency. Falls back to a naive sum if FX lookup fails,
   * so the dashboard never breaks on a currency-service outage.
   */
  private async sumInDefaultCurrency(
    groups: { currency: string; balance: number }[],
    defaultCurrency: string,
  ): Promise<number> {
    try {
      let total = 0;
      for (const g of groups) {
        const cur = g.currency || defaultCurrency;
        total += cur === defaultCurrency ? g.balance : await this.currency.convert(g.balance, cur, defaultCurrency);
      }
      return total;
    } catch {
      return groups.reduce((sum, g) => sum + g.balance, 0);
    }
  }

  private async getGroupSettlements(groupIds: string[]): Promise<Map<string, SettlementEntry[]>> {
    const map = new Map<string, SettlementEntry[]>();
    if (groupIds.length === 0) return map;
    const settlements = await this.prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      select: { groupId: true, payerId: true, payeeId: true, amount: true },
    });
    for (const s of settlements) {
      if (!s.groupId) continue;
      const arr = map.get(s.groupId) ?? [];
      arr.push({ payerId: s.payerId, payeeId: s.payeeId, amount: s.amount.toNumber() });
      map.set(s.groupId, arr);
    }
    return map;
  }

  async updateProfile(userId: string, input: unknown) {
    const data = updateProfileSchema.parse(input);
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        defaultCurrency: true,
      },
    });
  }
}
