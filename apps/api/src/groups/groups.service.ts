import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createGroupSchema, updateGroupSchema, addMemberSchema, updateMemberRoleSchema, joinGroupSchema, getGroupAccentColor, computePairwiseDebts, buildMemberDebtSummaries, generateInviteCode, normalizeInviteCode } from '@split/shared';
import { calculateBalances, simplifyDebts, applySettlements, type SettlementEntry } from '@split/shared';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private buildInviteLink(inviteCode: string): string {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:8081').replace(/\/$/, '');
    return `${appUrl}/join-group?code=${encodeURIComponent(inviteCode)}`;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { deletedAt: null } },
      include: {
        group: {
          include: {
            members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            expenses: {
              where: { deletedAt: null },
              include: { splits: true, paidBy: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const settlementMap = await this.getGroupSettlements(memberships.map((m) => m.group.id));

    return memberships.map((m) => {
      const balance = this.computeUserBalance(m.group.expenses, userId, settlementMap.get(m.group.id) ?? []);
      const { inviteCode: _inviteCode, ...group } = m.group;
      return {
        ...group,
        color: m.group.color ?? getGroupAccentColor(m.group.id),
        balance,
        memberCount: m.group.members.length,
      };
    });
  }

  async findOne(groupId: string, userId: string) {
    await this.ensureMember(groupId, userId);

    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        expenses: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          include: {
            splits: { include: { user: { select: { id: true, name: true } } } },
            paidBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    const settlementMap = await this.getGroupSettlements([groupId]);
    const groupSettlements = settlementMap.get(groupId) ?? [];
    const balances = this.computeGroupBalances(group.expenses, groupSettlements);
    const simplified = simplifyDebts(balances);
    const expenseInputs = group.expenses.map((e) => ({
      paidById: e.paidById,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount.toNumber() })),
    }));
    const pairwiseDebts = computePairwiseDebts(expenseInputs, groupSettlements);
    const memberIds = group.members.map((m) => m.user.id);
    const memberDebtSummaries = buildMemberDebtSummaries(pairwiseDebts, memberIds);

    const { inviteCode: _inviteCode, ...groupSafe } = group;

    return {
      ...groupSafe,
      color: group.color ?? getGroupAccentColor(group.id),
      balances: Object.fromEntries(balances),
      simplifiedDebts: simplified,
      pairwiseDebts,
      memberDebtSummaries,
      userBalance: balances.get(userId) ?? 0,
      expenses: group.expenses.map((e) => ({
        ...e,
        amount: e.amount.toNumber(),
        splits: e.splits.map((s) => ({ ...s, amount: s.amount.toNumber() })),
      })),
    };
  }

  async create(userId: string, input: unknown) {
    const data = createGroupSchema.parse(input);

    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true, emailVerified: true },
    });
    if (!creator?.emailVerified) {
      throw new BadRequestException('You must verify your email before creating a group.');
    }

    const memberIds: string[] = [];
    if (data.memberEmails?.length) {
      // Only add verified users when creating the group.
      const users = await this.prisma.user.findMany({
        where: { email: { in: data.memberEmails }, emailVerified: true, deletedAt: null },
      });
      memberIds.push(...users.map((u) => u.id).filter((id) => id !== userId));
    }

    const group = await this.prisma.group.create({
      data: {
        name: data.name,
        category: data.category,
        currency: data.currency ?? creator?.defaultCurrency ?? 'USD',
        inviteCode: await this.generateUniqueInviteCode(),
        color: getGroupAccentColor(crypto.randomUUID()),
        createdBy: userId,
        members: {
          create: [
            { userId, role: 'admin' },
            ...memberIds.map((id) => ({ userId: id, role: 'member' })),
          ],
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });

    return group;
  }

  async updateGroup(groupId: string, userId: string, input: unknown) {
    await this.ensureAdmin(groupId, userId);
    const data = updateGroupSchema.parse(input);

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.update({
        where: { id: groupId },
        data: {
          name: data.name,
          category: data.category,
          currency: data.currency,
        },
        include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
      });

      if (data.currency) {
        await tx.expense.updateMany({
          where: { groupId, deletedAt: null },
          data: { currency: data.currency },
        });
      }

      return group;
    });
  }

  async getGroupCurrency(groupId: string, userId: string): Promise<string> {
    await this.ensureMember(groupId, userId);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { currency: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group.currency;
  }

  async getMemberList(groupId: string, userId: string) {
    await this.ensureMember(groupId, userId);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, group: { deletedAt: null } },
      include: { user: { select: { id: true, name: true } } },
    });
    return members.map((m) => ({ id: m.user.id, name: m.user.name }));
  }

  /** Unique members across the user's groups — used for AI parsing when no groupId is sent. */
  async getKnownMembersForUser(userId: string, maxGroups = 8) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { deletedAt: null } },
      select: { groupId: true },
      take: maxGroups,
    });

    if (memberships.length === 0) return [];

    const groupIds = memberships.map((m) => m.groupId);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, group: { deletedAt: null } },
      include: { user: { select: { id: true, name: true } } },
    });

    const byId = new Map<string, { id: string; name: string }>();
    for (const member of members) {
      byId.set(member.user.id, { id: member.user.id, name: member.user.name });
    }
    return [...byId.values()];
  }

  async addMember(groupId: string, userId: string, input: unknown) {
    await this.ensureAdmin(groupId, userId);
    const { email } = addMemberSchema.parse(input);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (!user.emailVerified) throw new BadRequestException('That user has not verified their email yet. Ask them to complete registration first.');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.groupMember.create({
      data: { groupId, userId: user.id, role: 'member' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateMemberRole(groupId: string, callerId: string, targetUserId: string, input: unknown) {
    await this.ensureAdmin(groupId, callerId);
    const { role } = updateMemberRoleSchema.parse(input);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found in this group');
    if (target.role === role) {
      return { userId: targetUserId, role };
    }

    // Never allow removing the last admin.
    if (role === 'member' && target.role === 'admin') {
      const adminCount = await this.prisma.groupMember.count({
        where: { groupId, role: 'admin', group: { deletedAt: null } },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('A group must have at least one admin');
      }
    }

    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role },
    });
    return { userId: targetUserId, role };
  }

  async getInvite(groupId: string, userId: string) {
    await this.ensureMember(groupId, userId);

    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, name: true, inviteCode: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const link = this.buildInviteLink(group.inviteCode);
    return {
      groupId: group.id,
      groupName: group.name,
      inviteCode: group.inviteCode,
      link,
      message: `Join "${group.name}" on Split!\nCode: ${group.inviteCode}\n${link}`,
    };
  }

  async regenerateInvite(groupId: string, userId: string) {
    await this.ensureAdmin(groupId, userId);

    const inviteCode = await this.generateUniqueInviteCode();
    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode },
      select: { id: true, name: true, inviteCode: true },
    });

    const link = this.buildInviteLink(group.inviteCode);
    return {
      groupId: group.id,
      groupName: group.name,
      inviteCode: group.inviteCode,
      link,
      message: `Join "${group.name}" on Split! Code: ${group.inviteCode}\n${link}`,
    };
  }

  async previewJoin(inviteCodeRaw: string, userId: string) {
    const inviteCode = normalizeInviteCode(inviteCodeRaw);
    const group = await this.prisma.group.findFirst({
      where: { inviteCode, deletedAt: null },
      include: {
        members: { select: { userId: true } },
      },
    });
    if (!group) throw new NotFoundException('Invalid invite code');

    const isMember = group.members.some((m) => m.userId === userId);

    return {
      groupId: group.id,
      name: group.name,
      category: group.category,
      currency: group.currency,
      memberCount: group.members.length,
      isMember,
    };
  }

  async joinByInvite(userId: string, input: unknown) {
    const { inviteCode: inviteCodeRaw } = joinGroupSchema.parse(input);
    const inviteCode = normalizeInviteCode(inviteCodeRaw);

    // Verify the joining user has a verified email.
    const joiner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    if (!joiner?.emailVerified) {
      throw new BadRequestException('You must verify your email before joining a group.');
    }

    const group = await this.prisma.group.findFirst({
      where: { inviteCode, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundException('Invalid invite code');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });
    if (existing) {
      return { groupId: group.id, name: group.name, alreadyMember: true };
    }

    await this.prisma.groupMember.create({
      data: { groupId: group.id, userId, role: 'member' },
    });

    return { groupId: group.id, name: group.name, alreadyMember: false };
  }

  async removeMember(groupId: string, callerId: string, targetUserId: string) {
    const callerMember = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: callerId, group: { deletedAt: null } },
    });
    if (!callerMember) throw new ForbiddenException('Not a group member');

    const isSelf = callerId === targetUserId;
    if (!isSelf && callerMember.role !== 'admin') {
      throw new ForbiddenException('Only admins can remove other members');
    }

    // Prevent removing the last admin.
    if (!isSelf) {
      const admins = await this.prisma.groupMember.count({
        where: { groupId, role: 'admin', group: { deletedAt: null } },
      });
      const targetMember = await this.prisma.groupMember.findFirst({
        where: { groupId, userId: targetUserId },
      });
      if (!targetMember) throw new NotFoundException('Member not found');
      if (targetMember.role === 'admin' && admins <= 1) {
        throw new BadRequestException('Cannot remove the last admin. Promote another member first.');
      }
    } else {
      // Leaving: prevent last admin from leaving.
      if (callerMember.role === 'admin') {
        const admins = await this.prisma.groupMember.count({
          where: { groupId, role: 'admin', group: { deletedAt: null } },
        });
        if (admins <= 1) {
          throw new BadRequestException('You are the last admin. Promote someone else before leaving.');
        }
      }
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    return { success: true };
  }

  async archive(groupId: string, userId: string) {
    await this.ensureAdmin(groupId, userId);
    return this.prisma.group.update({
      where: { id: groupId },
      data: { deletedAt: new Date() },
    });
  }

  async ensureMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, group: { deletedAt: null } },
    });
    if (!member) throw new ForbiddenException('Not a group member');
  }

  private async ensureAdmin(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, group: { deletedAt: null } },
    });
    if (!member || member.role !== 'admin') throw new ForbiddenException('Admin access required');
  }

  private computeUserBalance(
    expenses: { paidById: string; amount: { toNumber(): number }; splits: { userId: string; amount: { toNumber(): number } }[] }[],
    userId: string,
    settlements: SettlementEntry[] = [],
  ): number {
    const balances = this.computeGroupBalances(expenses, settlements);
    return Math.round((balances.get(userId) ?? 0) * 100) / 100;
  }

  private computeGroupBalances(
    expenses: { paidById: string; amount: { toNumber(): number }; splits: { userId: string; amount: { toNumber(): number } }[] }[],
    settlements: SettlementEntry[] = [],
  ): Map<string, number> {
    const splits = expenses.flatMap((e) =>
      e.splits.map((s) => ({
        userId: s.userId,
        amount: s.amount.toNumber(),
        paid: e.paidById === s.userId ? e.amount.toNumber() : 0,
      })),
    );
    return applySettlements(calculateBalances(splits), settlements);
  }

  /** Fetch settlements for the given groups, keyed by groupId. */
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

  private async generateUniqueInviteCode(maxAttempts = 10): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const inviteCode = generateInviteCode();
      const existing = await this.prisma.group.findUnique({
        where: { inviteCode },
        select: { id: true },
      });
      if (!existing) return inviteCode;
    }
    throw new ConflictException('Could not generate invite code');
  }
}
