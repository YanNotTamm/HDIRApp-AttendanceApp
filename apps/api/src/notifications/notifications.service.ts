import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Notifications: the model existed in the schema but no endpoint and no
 * writer existed — users could never see anything. Notifications are now
 * written for real events (see leave/attendance services) and readable by
 * their owner only. There is no push delivery (no FCM/APNs integration in
 * this repo): "notification" here means an in-app inbox row, and README
 * says so explicitly. Marking another user's notification as read is a
 * 404, not a silent success, so ownership cannot be probed by id.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(userId: number, title: string, body: string, type = 'info'): Promise<void> {
    try {
      await this.prisma.notification.create({ data: { user_id: userId, title, body, type } });
    } catch {
      // A failed notification must never roll back the business event.
    }
  }

  async notifyRole(roleNames: string[], title: string, body: string, type = 'approval'): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { status: 'active', role: { name: { in: roleNames } } },
        select: { id: true },
      });
      for (const u of users) {
        await this.notify(u.id, title, body, type);
      }
    } catch {
      /* best-effort, see notify() */
    }
  }

  async listForUser(userId: number) {
    const rows = await this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return { success: true, data: rows };
  }

  async markRead(userId: number, id: number) {
    const row = await this.prisma.notification.findFirst({ where: { id, user_id: userId } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    const updated = await this.prisma.notification.update({ where: { id }, data: { is_read: true } });
    return { success: true, data: updated };
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({ where: { user_id: userId, is_read: false }, data: { is_read: true } });
    return { success: true, message: 'All notifications marked as read' };
  }
}
