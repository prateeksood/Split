import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      verifiedUsers,
      totalGroups,
      totalExpenses,
      totalSettlements,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      totalExpenseAmount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, emailVerified: true } }),
      this.prisma.group.count({ where: { deletedAt: null } }),
      this.prisma.expense.count({ where: { deletedAt: null } }),
      this.prisma.settlement.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOf('day') }, deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOf('week') }, deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOf('month') }, deletedAt: null } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { deletedAt: null } }),
    ]);

    return {
      users: { total: totalUsers, verified: verifiedUsers, unverified: totalUsers - verifiedUsers, newToday: newUsersToday, newThisWeek: newUsersThisWeek, newThisMonth: newUsersThisMonth },
      groups: { total: totalGroups },
      expenses: { total: totalExpenses, totalAmount: Number(totalExpenseAmount._sum.amount ?? 0) },
      settlements: { total: totalSettlements },
    };
  }

  async getAiStats() {
    try {
      const [totalParseRequests, byProvider] = await Promise.all([
        this.prisma.aiParseLog.count(),
        this.prisma.aiParseLog.groupBy({
          by: ['provider'],
          _count: { provider: true },
          orderBy: { _count: { provider: 'desc' } },
        }),
      ]);

      const last24h = await this.prisma.aiParseLog.count({
        where: { createdAt: { gte: startOf('day') } },
      });

      return {
        total: totalParseRequests,
        last24h,
        byProvider: byProvider.map((r) => ({ provider: r.provider, count: r._count.provider })),
      };
    } catch {
      // Table may not exist yet — migration pending. Return empty stats.
      return { total: 0, last24h: 0, byProvider: [] };
    }
  }

  // ─── Recent activity / logs ────────────────────────────────────────────────

  async getRecentSignups(limit = 20) {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, email: true, emailVerified: true, googleId: true, createdAt: true },
    });
  }

  async getRecentLogins(limit = 20) {
    return this.prisma.refreshToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ─── User management ──────────────────────────────────────────────────────

  async listUsers(page: number, limit: number, search?: string, status: 'all' | 'active' | 'deactivated' = 'all') {
    const where = {
      // Purged tombstones are hidden unless explicitly requested elsewhere.
      NOT: { email: { endsWith: '@deleted.local' } },
      ...(status === 'active' ? { deletedAt: null } : {}),
      ...(status === 'deactivated' ? { deletedAt: { not: null } } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ deletedAt: 'desc' }, { createdAt: 'desc' }],
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          googleId: true,
          createdAt: true,
          deletedAt: true,
          _count: { select: { groupMembers: true, expensesPaid: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, hasMore: (page + 1) * limit < total };
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        googleId: true,
        createdAt: true,
        groupMembers: {
          include: { group: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        _count: { select: { groupMembers: true, expensesPaid: true, settlementsFrom: true } },
      },
    });
  }

  async deactivateUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    // Invalidate all refresh tokens.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.endsWith('@deleted.local')) {
      throw new BadRequestException('Purged accounts cannot be reactivated. The user must register again.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
    return { success: true };
  }

  /**
   * Permanently purge a user account for re-registration.
   * Does NOT delete the DB row — expenses/settlements/audit logs keep a tombstone
   * ("Deleted User") so group history and balances stay intact.
   * Clears credentials, releases email/username/googleId, and removes memberships.
   */
  async purgeUser(userId: string, callerId: string) {
    if (userId === callerId) {
      throw new BadRequestException('You cannot purge your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.endsWith('@deleted.local')) {
      throw new BadRequestException('Account is already purged');
    }

    const originalEmail = user.email;
    const tombstoneEmail = `purged.${userId}@deleted.local`;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.groupMember.deleteMany({ where: { userId } });
      await tx.friendship.deleteMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: tombstoneEmail,
          name: 'Deleted User',
          username: null,
          passwordHash: null,
          googleId: null,
          avatarUrl: null,
          pushToken: null,
          emailVerified: false,
          deletedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      message: `${originalEmail} has been purged. That email can be used to register a new account. Past expenses and settlements are preserved under "Deleted User".`,
    };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      return { message: `${user.email} is already verified` };
    }

    // Create a real verification token so the email link works.
    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.email.sendVerificationEmail(user.email, token);
    return { message: `Verification email sent to ${user.email}` };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month'): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (unit === 'week') d.setDate(d.getDate() - d.getDay());
  if (unit === 'month') d.setDate(1);
  return d;
}
