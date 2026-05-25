import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { CreateNotificationDto, NotificationPreferencesDto } from '@shared/dto';
import { Logger } from '../../common/utils/logger';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private rabbitMQ: RabbitMQService,
  ) {}

  async create(userId: string, dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        message: dto.body,
        data: dto.data || null,
        channel: dto.channel || 'IN_APP',
        priority: dto.priority || 'NORMAL',
      },
    });

    // Send via appropriate channels
    if (dto.sendPush || dto.channel === 'PUSH') {
      await this.sendPushNotification(userId, notification);
    }

    return notification;
  }

  async findAll(userId: string, unreadOnly: boolean = false) {
    const where: any = { userId };
    if (unreadOnly) {
      where.read = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(userId: string, id: string) {
    return this.prisma.notification.findFirst({
      where: { id, userId },
    });
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { message: 'All notifications marked as read' };
  }

  async delete(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return { message: 'Notification not found' };
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { message: 'Notification deleted' };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    return { count };
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    const defaultPrefs: NotificationPreferencesDto = {
      pushEnabled: true,
      emailEnabled: false,
      smsEnabled: false,
      transactionAlerts: true,
      subscriptionAlerts: true,
      budgetAlerts: true,
      insightAlerts: false,
      securityAlerts: true,
      minAmountForAlert: 1000,
    };

    if (!user?.notificationPrefs) {
      return defaultPrefs;
    }

    return { ...defaultPrefs, ...(user.notificationPrefs as any) };
  }

  async updatePreferences(userId: string, prefs: Partial<NotificationPreferencesDto>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const currentPrefs = (user?.notificationPrefs as any) || {};
    const updatedPrefs = { ...currentPrefs, ...prefs };

    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: updatedPrefs },
    });

    return this.getPreferences(userId);
  }

  private async sendPushNotification(userId: string, notification: any) {
    try {
      // In production, this would integrate with Firebase Cloud Messaging
      await this.rabbitMQ.publishNotificationRequest({
        userId,
        type: notification.type,
        title: notification.title,
        body: notification.message,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          sentAt: new Date(),
        },
      });

      this.logger.debug(`Push notification sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
    }
  }

  // Notification helpers for different events
  async sendTransactionNotification(
    userId: string,
    transaction: { amount: number; merchant?: string; type: string; category?: string },
  ) {
    const prefs = await this.getPreferences(userId);

    if (!prefs.transactionAlerts) {
      return;
    }

    if (prefs.minAmountForAlert && transaction.amount < prefs.minAmountForAlert) {
      return;
    }

    const isCredit = transaction.type === 'CREDIT';

    await this.create(userId, {
      type: 'TRANSACTION',
      title: isCredit ? 'Money Credited' : 'Money Debited',
      body: `${isCredit ? '₹' : '-₹'}${transaction.amount} ${transaction.merchant ? `at ${transaction.merchant}` : ''}`,
      priority: 'NORMAL',
      sendPush: prefs.pushEnabled,
      data: { transaction },
    });
  }

  async sendSubscriptionNotification(
    userId: string,
    subscription: { name: string; amount: number; nextBillingDate: Date },
  ) {
    const prefs = await this.getPreferences(userId);

    if (!prefs.subscriptionAlerts) {
      return;
    }

    await this.create(userId, {
      type: 'SUBSCRIPTION',
      title: 'Upcoming Subscription Payment',
      body: `${subscription.name} of ₹${subscription.amount} due on ${subscription.nextBillingDate.toLocaleDateString()}`,
      priority: 'HIGH',
      sendPush: prefs.pushEnabled,
      data: { subscription },
    });
  }

  async sendBudgetAlert(userId: string, category: string, spent: number, limit: number) {
    const prefs = await this.getPreferences(userId);

    if (!prefs.budgetAlerts) {
      return;
    }

    const percentage = (spent / limit) * 100;

    await this.create(userId, {
      type: 'BUDGET_ALERT',
      title: percentage >= 100 ? 'Budget Exceeded' : 'Budget Warning',
      body: `You've spent ${percentage.toFixed(0)}% of your ${category} budget (₹${spent} of ₹${limit})`,
      priority: percentage >= 90 ? 'URGENT' : 'HIGH',
      sendPush: prefs.pushEnabled,
      data: { category, spent, limit, percentage },
    });
  }

  async sendInsightNotification(userId: string, title: string, body: string) {
    const prefs = await this.getPreferences(userId);

    if (!prefs.insightAlerts) {
      return;
    }

    await this.create(userId, {
      type: 'INSIGHT',
      title,
      body,
      priority: 'NORMAL',
      sendPush: prefs.pushEnabled,
    });
  }

  async sendSecurityAlert(userId: string, title: string, body: string) {
    const prefs = await this.getPreferences(userId);

    await this.create(userId, {
      type: 'SECURITY',
      title,
      body,
      priority: 'URGENT',
      sendPush: prefs.pushEnabled,
      channel: 'PUSH',
    });
  }
}
