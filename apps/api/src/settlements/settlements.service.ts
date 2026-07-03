import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { settlementSchema } from '@split/shared';

@Injectable()
export class SettlementsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(callerId: string, input: unknown) {
    const data = settlementSchema.parse(input);
    // Only the payer can record a payment — prevents payee from unilaterally claiming "X paid me".
    const payerId = callerId;
    const payeeId = data.payeeId;
    let currency = data.currency;

    if (payerId === payeeId) {
      throw new BadRequestException('Payer and payee must be different people');
    }

    if (data.groupId) {
      const group = await this.prisma.group.findFirst({
        where: { id: data.groupId, deletedAt: null },
        select: { currency: true },
      });
      if (!group) throw new BadRequestException('Group not found');

      const members = await this.prisma.groupMember.findMany({
        where: { groupId: data.groupId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m) => m.userId));
      if (!memberIds.has(payerId) || !memberIds.has(payeeId)) {
        throw new BadRequestException('Payer and payee must be group members');
      }

      currency = group.currency;
    } else {
      // No group context: only allow settling with someone you share a group or friendship with.
      const otherId = callerId === payerId ? payeeId : payerId;
      if (!(await this.hasRelationship(callerId, otherId))) {
        throw new ForbiddenException('You can only settle with people you share a group or friendship with');
      }
    }

    const settlement = await this.prisma.settlement.create({
      data: {
        payerId,
        payeeId,
        amount: data.amount,
        currency,
        groupId: data.groupId,
        note: data.note,
        paymentRef: data.paymentRef,
      },
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    });

    await this.notifications.notify(
      payeeId,
      'settlement',
      'Payment recorded',
      `${settlement.payer.name} recorded a payment of ${data.amount} ${currency}`,
      { settlementId: settlement.id },
    );

    return settlement;
  }

  private async hasRelationship(a: string, b: string): Promise<boolean> {
    const sharedGroup = await this.prisma.groupMember.findFirst({
      where: { userId: a, group: { deletedAt: null, members: { some: { userId: b } } } },
      select: { id: true },
    });
    if (sharedGroup) return true;

    const [userAId, userBId] = a < b ? [a, b] : [b, a];
    const friendship = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId }, status: 'accepted' },
      select: { id: true },
    });
    return !!friendship;
  }

  async findForUser(userId: string, limit = 50) {
    const rows = await this.prisma.settlement.findMany({
      where: { OR: [{ payerId: userId }, { payeeId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    });
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map((s) => ({ ...s, amount: Number(s.amount) })),
      hasMore,
    };
  }

  async delete(settlementId: string, callerId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) throw new ForbiddenException('Settlement not found');
    if (settlement.payerId !== callerId) {
      throw new ForbiddenException('Only the payer can void a settlement');
    }
    await this.prisma.settlement.delete({ where: { id: settlementId } });
    return { success: true };
  }
}
