import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createExpenseSchema, updateExpenseSchema } from '@split/shared';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findRecentForUser(userId: string, limit = 20) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });

    const groupIds = memberships.map((m) => m.groupId);

    const expenses = await this.prisma.expense.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        group: { select: { id: true, name: true, color: true } },
        paidBy: { select: { id: true, name: true } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    return expenses.map((e) => ({
      ...e,
      amount: e.amount.toNumber(),
      userShare: e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0,
      userOwes: e.paidById !== userId,
    }));
  }

  async create(userId: string, input: unknown) {
    const data = createExpenseSchema.parse(input);

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: data.groupId, userId, group: { deletedAt: null } },
    });
    if (!member) throw new ForbiddenException('Not a group member');

    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, deletedAt: null },
      select: { currency: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const groupMembers = await this.prisma.groupMember.findMany({
      where: { groupId: data.groupId, group: { deletedAt: null } },
      select: { userId: true },
    });
    const memberIds = new Set(groupMembers.map((m) => m.userId));

    if (!memberIds.has(data.paidById)) {
      throw new BadRequestException('Payer must be a group member');
    }

    const invalidSplitUsers = data.splits.filter((s) => !memberIds.has(s.userId));
    if (invalidSplitUsers.length > 0) {
      throw new BadRequestException('All split participants must be group members');
    }

    if (data.splits.length === 0) {
      throw new BadRequestException('At least one participant is required');
    }

    const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(splitTotal - data.amount) > 0.01) {
      throw new BadRequestException('Split amounts must equal expense total');
    }

    // Validate receipt URL belongs to caller's upload namespace using URL parsing (not substring).
    if (data.receiptUrl) {
      try {
        const parsed = new URL(data.receiptUrl);
        const expectedPath = `/receipts/${userId}/`;
        if (!parsed.pathname.startsWith(expectedPath)) {
          throw new BadRequestException('Invalid receipt reference');
        }
      } catch {
        throw new BadRequestException('Invalid receipt URL');
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        groupId: data.groupId,
        description: data.description,
        amount: data.amount,
        currency: group.currency,
        category: data.category,
        paidById: data.paidById,
        date: data.date ? new Date(data.date) : new Date(),
        splitType: data.splitType,
        receiptUrl: data.receiptUrl,
        splits: {
          create: data.splits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
          })),
        },
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true } } } },
        paidBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });

    // Write audit log entry.
    await this.prisma.expenseAuditLog.create({
      data: {
        expenseId: expense.id,
        groupId: data.groupId,
        actorId: userId,
        action: 'created',
        description: data.description,
        amount: data.amount,
        category: data.category ?? 'Other',
        paidById: data.paidById,
        splitType: data.splitType ?? 'equal',
      },
    });

    const payer = expense.paidBy.name;
    await this.notifications.notifyGroupMembers(
      data.groupId,
      userId,
      'expense_added',
      'New expense',
      `${payer} added "${data.description}" (${data.amount} ${group.currency})`,
      { expenseId: expense.id, groupId: data.groupId },
    );

    return { ...expense, amount: expense.amount.toNumber() };
  }

  async update(expenseId: string, userId: string, input: unknown) {
    const data = updateExpenseSchema.parse(input);

    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, deletedAt: null },
      include: { splits: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: expense.groupId, userId, group: { deletedAt: null } },
    });
    if (!member) throw new ForbiddenException('Not a group member');
    if (expense.paidById !== userId && member.role !== 'admin') {
      throw new ForbiddenException('Only the expense payer or a group admin can edit this expense');
    }

    const group = await this.prisma.group.findFirst({
      where: { id: expense.groupId, deletedAt: null },
      select: { currency: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const groupMembers = await this.prisma.groupMember.findMany({
      where: { groupId: expense.groupId, group: { deletedAt: null } },
      select: { userId: true },
    });
    const memberIds = new Set(groupMembers.map((m) => m.userId));

    if (data.paidById && !memberIds.has(data.paidById)) {
      throw new BadRequestException('Payer must be a group member');
    }

    if (data.splits) {
      const invalidSplitUsers = data.splits.filter((s) => !memberIds.has(s.userId));
      if (invalidSplitUsers.length > 0) {
        throw new BadRequestException('All split participants must be group members');
      }
      if (data.splits.length === 0) {
        throw new BadRequestException('At least one participant is required');
      }
      const totalAmount = data.amount ?? expense.amount.toNumber();
      const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        throw new BadRequestException('Split amounts must equal expense total');
      }
    }

    if (data.receiptUrl) {
      try {
        const parsed = new URL(data.receiptUrl);
        if (!parsed.pathname.startsWith(`/receipts/${userId}/`)) {
          throw new BadRequestException('Invalid receipt reference');
        }
      } catch {
        throw new BadRequestException('Invalid receipt URL');
      }
    }

    const oldAmount = expense.amount.toNumber();
    const newAmount = data.amount ?? oldAmount;
    const scale = oldAmount > 0 ? newAmount / oldAmount : 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description,
          amount: data.amount,
          currency: group.currency,
          category: data.category,
          paidById: data.paidById,
          splitType: data.splitType,
          receiptUrl: data.receiptUrl,
        },
      });

      if (data.splits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseSplit.createMany({
          data: data.splits.map((s) => ({
            expenseId,
            userId: s.userId,
            amount: s.amount,
          })),
        });
      } else if (data.amount !== undefined && Math.abs(scale - 1) > 0.001) {
        for (const split of expense.splits) {
          await tx.expenseSplit.update({
            where: { id: split.id },
            data: { amount: Math.round(split.amount.toNumber() * scale * 100) / 100 },
          });
        }
      }
    });

    // Build diff of changed fields for audit trail.
    const diff: Record<string, [unknown, unknown]> = {};
    if (data.description !== undefined && data.description !== expense.description) diff.description = [expense.description, data.description];
    if (data.amount !== undefined && data.amount !== expense.amount.toNumber()) diff.amount = [expense.amount.toNumber(), data.amount];
    if (data.category !== undefined && data.category !== expense.category) diff.category = [expense.category, data.category];
    if (data.paidById !== undefined && data.paidById !== expense.paidById) diff.paidById = [expense.paidById, data.paidById];
    if (data.splitType !== undefined && data.splitType !== expense.splitType) diff.splitType = [expense.splitType, data.splitType];
    if (data.receiptUrl !== undefined && data.receiptUrl !== expense.receiptUrl) diff.receiptUrl = [expense.receiptUrl, data.receiptUrl];

    if (data.splits) {
      const oldSplits = expense.splits
        .map((s) => ({ userId: s.userId, amount: s.amount.toNumber() }))
        .sort((a, b) => a.userId.localeCompare(b.userId));
      const newSplits = data.splits
        .map((s) => ({ userId: s.userId, amount: s.amount }))
        .sort((a, b) => a.userId.localeCompare(b.userId));
      if (JSON.stringify(oldSplits) !== JSON.stringify(newSplits)) {
        diff.splits = [oldSplits, newSplits];
      }
    } else if (data.amount !== undefined && Math.abs(scale - 1) > 0.001) {
      diff.splits = [
        expense.splits.map((s) => ({ userId: s.userId, amount: s.amount.toNumber() })),
        expense.splits.map((s) => ({
          userId: s.userId,
          amount: Math.round(s.amount.toNumber() * scale * 100) / 100,
        })),
      ];
    }

    if (Object.keys(diff).length > 0) {
      await this.prisma.expenseAuditLog.create({
        data: {
          expenseId,
          groupId: expense.groupId,
          actorId: userId,
          action: 'updated',
          description: data.description ?? expense.description,
          amount: data.amount ?? expense.amount,
          category: data.category ?? expense.category,
          paidById: data.paidById ?? expense.paidById,
          splitType: data.splitType ?? expense.splitType,
          diff: diff as object,
        },
      });
    }

    const updated = await this.prisma.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: {
        splits: { include: { user: { select: { id: true, name: true } } } },
        paidBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return { ...updated, amount: updated.amount.toNumber() };
  }

  async softDelete(expenseId: string, userId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, deletedAt: null },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: expense.groupId, userId, group: { deletedAt: null } },
    });
    if (!member) throw new ForbiddenException('Not a group member');
    if (expense.paidById !== userId && member.role !== 'admin') {
      throw new ForbiddenException('Only the expense payer or a group admin can delete this expense');
    }

    await this.prisma.expenseAuditLog.create({
      data: {
        expenseId,
        groupId: expense.groupId,
        actorId: userId,
        action: 'deleted',
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        paidById: expense.paidById,
        splitType: expense.splitType,
      },
    });

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });
  }
}
