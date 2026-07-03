import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async findForUser(userId: string, page = 0, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 0);
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: safePage * safeLimit,
      take: safeLimit + 1,
    });
    const hasMore = items.length > safeLimit;
    return { items: hasMore ? items.slice(0, safeLimit) : items, page: safePage, hasMore };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async notify(userId: string, type: string, title: string, body: string, data?: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data: data as object | undefined },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (user?.pushToken) {
      await this.push.send({
        pushToken: user.pushToken,
        title,
        body,
        data: { ...data, type, notificationId: notification.id },
      });
    }

    return notification;
  }

  async notifyGroupMembers(
    groupId: string,
    excludeUserId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { not: excludeUserId } },
    });
    await Promise.all(
      members.map((m) => this.notify(m.userId, type, title, body, data)),
    );
  }
}
