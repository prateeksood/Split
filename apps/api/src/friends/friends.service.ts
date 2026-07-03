import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { addFriendSchema, simplifyDebts } from '@split/shared';
import { calculateBalances, applySettlements, type SettlementEntry } from '@split/shared';

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async listWithBalances(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { deletedAt: null } },
      include: {
        group: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
            expenses: {
              where: { deletedAt: null },
              include: { splits: true },
            },
          },
        },
      },
    });

    const friendMap = new Map<
      string,
      { id: string; name: string; email: string; avatarUrl: string | null; balance: number }
    >();

    const settlementMap = await this.getGroupSettlements(memberships.map((m) => m.group.id));

    for (const membership of memberships) {
      const group = membership.group;
      const groupBalances = this.computeGroupBalances(group.expenses, settlementMap.get(group.id) ?? []);
      const myBalance = groupBalances.get(userId) ?? 0;

      // Use simplified debts for accurate pairwise amounts in any group size.
      const simplified = simplifyDebts(groupBalances);
      for (const debt of simplified) {
        // debt.payerId owes debt.payeeId the amount.
        let delta = 0;
        let otherId: string | null = null;
        if (debt.payerId === userId) {
          // I owe someone — negative balance toward them.
          delta = -Math.round(debt.amount * 100) / 100;
          otherId = debt.payeeId;
        } else if (debt.payeeId === userId) {
          // Someone owes me — positive balance toward them.
          delta = Math.round(debt.amount * 100) / 100;
          otherId = debt.payerId;
        }
        if (otherId === null) continue;

        const memberEntry = group.members.find((m) => m.userId === otherId);
        if (!memberEntry) continue;

        const existing = friendMap.get(otherId);
        if (existing) {
          existing.balance = Math.round((existing.balance + delta) * 100) / 100;
        } else {
          friendMap.set(otherId, {
            id: memberEntry.user.id,
            name: memberEntry.user.name,
            email: memberEntry.user.email,
            avatarUrl: memberEntry.user.avatarUrl,
            balance: delta,
          });
        }
      }
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: 'accepted',
      },
      include: {
        userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    for (const f of friendships) {
      const friend = f.userAId === userId ? f.userB : f.userA;
      if (!friendMap.has(friend.id)) {
        friendMap.set(friend.id, {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          avatarUrl: friend.avatarUrl,
          balance: 0,
        });
      }
    }

    // Direct (non-group) settlements between the user and a friend adjust the 1:1 balance.
    // (Group settlements are already reflected via group balances above.)
    const directSettlements = await this.prisma.settlement.findMany({
      where: { groupId: null, OR: [{ payerId: userId }, { payeeId: userId }] },
      select: { payerId: true, payeeId: true, amount: true },
    });
    for (const s of directSettlements) {
      const friendId = s.payerId === userId ? s.payeeId : s.payerId;
      const entry = friendMap.get(friendId);
      if (!entry) continue;
      const amount = s.amount.toNumber();
      // Positive balance = friend owes you. Paying the friend moves balance up.
      entry.balance = Math.round((entry.balance + (s.payerId === userId ? amount : -amount)) * 100) / 100;
    }

    return [...friendMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async addFriend(userId: string, input: unknown) {
    const { email } = addFriendSchema.parse(input);

    const friend = await this.prisma.user.findUnique({ where: { email } });
    // Generic error to prevent email enumeration.
    if (!friend || friend.deletedAt || !friend.emailVerified) {
      throw new NotFoundException('No verified user found with that email');
    }
    if (friend.id === userId) throw new ConflictException('Cannot add yourself');

    const [userAId, userBId] = userId < friend.id ? [userId, friend.id] : [friend.id, userId];

    const existing = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (existing) return existing;

    return this.prisma.friendship.create({
      data: { userAId, userBId, status: 'accepted' },
      include: {
        userA: { select: { id: true, name: true, email: true } },
        userB: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async acceptInvite(userId: string, refUserId: string) {
    if (!refUserId || refUserId === userId) {
      throw new BadRequestException('Invalid invite link');
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: refUserId },
      select: { id: true, name: true },
    });
    if (!inviter) throw new NotFoundException('Inviter not found');

    const [userAId, userBId] = userId < inviter.id ? [userId, inviter.id] : [inviter.id, userId];

    const existing = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (existing) {
      return { friendId: inviter.id, name: inviter.name, alreadyFriends: true };
    }

    await this.prisma.friendship.create({
      data: { userAId, userBId, status: 'accepted' },
    });
    return { friendId: inviter.id, name: inviter.name, alreadyFriends: false };
  }

  async getInviteLink(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:8081').replace(/\/$/, '');
    const link = `${appUrl}/invite?ref=${user.id}`;
    const message = `Join me on Split! Track shared expenses easily.\n${link}`;
    return {
      link,
      message,
      smsUrl: `sms:?body=${encodeURIComponent(message)}`,
    };
  }

  private computeGroupBalances(
    expenses: { paidById: string; amount: { toNumber(): number }; splits: { userId: string; amount: { toNumber(): number } }[] }[],
    settlements: SettlementEntry[] = [],
  ) {
    const splits = expenses.flatMap((e) =>
      e.splits.map((s) => ({
        userId: s.userId,
        amount: s.amount.toNumber(),
        paid: e.paidById === s.userId ? e.amount.toNumber() : 0,
      })),
    );
    return applySettlements(calculateBalances(splits), settlements);
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

}
