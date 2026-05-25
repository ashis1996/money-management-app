import { Controller, OnModuleInit } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PrismaService } from '../../config/prisma.service';
import { SmsService } from '../../modules/sms/sms.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { NotificationService } from '../../modules/notification/notification.service';
import { Logger } from '../utils/logger';

interface RabbitMQMessage<T> {
  type: string;
  data: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Controller()
export class RabbitMQConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQConsumer.name);

  constructor(
    private smsService: SmsService,
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('RabbitMQ Consumer initialized');
  }

  /**
   * Consumes SMS_RECEIVED events
   * Processes raw SMS and creates transactions
   */
  @MessagePattern('sms.received')
  async handleSmsReceived(@Payload() message: RabbitMQMessage<{ smsId: string; body: string; sender: string; timestamp: Date }>) {
    this.logger.log(`Processing SMS: ${message.data.smsId}`);

    try {
      const { smsId, body, sender, timestamp } = message.data;

      // Parse the SMS
      const parsed = await this.smsService.parseSms(body, sender, timestamp);

      // Update SMS log
      await this.prisma.smsLog.update({
        where: { id: smsId },
        data: {
          isProcessed: true,
          parsedData: parsed as any,
        },
      });

      // Create transaction if we have valid data
      if (parsed.amount && parsed.transactionType) {
        const smsLog = await this.prisma.smsLog.findUnique({
          where: { id: smsId },
        });

        if (smsLog) {
          const transaction = await this.prisma.transaction.create({
            data: {
              userId: smsLog.userId,
              amount: parsed.amount,
              type: parsed.transactionType,
              categoryId: parsed.category,
              merchantName: parsed.merchant,
              transactionDate: parsed.timestamp,
              rawSmsText: body,
              smsSenderId: sender,
              source: 'SMS',
            },
          });

          // Link SMS to transaction
          await this.prisma.smsLog.update({
            where: { id: smsId },
            data: { transactionId: transaction.id },
          });

          this.logger.log(`Created transaction ${transaction.id} from SMS`);

          // Send notification for large transactions
          if (parsed.amount >= 1000) {
            await this.notificationService.sendTransactionNotification(smsLog.userId, {
              amount: parsed.amount,
              merchant: parsed.merchant,
              type: parsed.transactionType,
              category: parsed.category,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process SMS ${message.data.smsId}: ${error.message}`);
    }
  }

  /**
   * Consumes TRANSACTION_CREATED events
   * Triggers subscription detection and notifications
   */
  @MessagePattern('transaction.created')
  async handleTransactionCreated(@Payload() message: RabbitMQMessage<{ transactionId: string; userId: string; amount: number; category: string }>) {
    this.logger.log(`Processing transaction: ${message.data.transactionId}`);

    try {
      const { transactionId, userId, amount, category } = message.data;

      // Send notification for this transaction
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (transaction) {
        await this.notificationService.sendTransactionNotification(userId, {
          amount: Number(transaction.amount),
          merchant: transaction.merchantName || undefined,
          type: transaction.type,
          category: transaction.categoryId || undefined,
        });

        // Check for subscription pattern if it's a debit
        if (transaction.type === 'DEBIT' && transaction.merchantName) {
          await this.checkForSubscriptionPattern(userId, transaction.merchantName);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process transaction ${message.data.transactionId}: ${error.message}`);
    }
  }

  /**
   * Consumes SUBSCRIPTION_DETECTED events
   * Sends notification to user about new subscription
   */
  @MessagePattern('subscription.detected')
  async handleSubscriptionDetected(@Payload() message: RabbitMQMessage<{ subscriptionId: string; userId: string; merchant: string; amount: number }>) {
    this.logger.log(`Processing subscription detection: ${message.data.subscriptionId}`);

    try {
      const { subscriptionId, userId, merchant, amount } = message.data;

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (subscription) {
        await this.notificationService.sendSubscriptionNotification(userId, {
          name: subscription.name,
          amount: Number(subscription.amount),
          nextBillingDate: subscription.nextBillingDate || new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process subscription detection ${message.data.subscriptionId}: ${error.message}`);
    }
  }

  /**
   * Consumes NOTIFICATION_REQUEST events
   * Creates notifications in the database
   */
  @MessagePattern('notifications')
  async handleNotificationRequest(@Payload() message: RabbitMQMessage<{ userId: string; type: string; title: string; body: string }>) {
    this.logger.log(`Processing notification request for user: ${message.data.userId}`);

    try {
      const { userId, type, title, body } = message.data;

      await this.prisma.notification.create({
        data: {
          userId,
          type: type as any,
          title,
          message: body,
          channel: 'PUSH',
          priority: 'NORMAL',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Check if a merchant transaction pattern indicates a subscription
   */
  private async checkForSubscriptionPattern(userId: string, merchantName: string) {
    // Get all transactions for this merchant
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        merchantName,
        type: 'DEBIT',
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Need at least 3 transactions to detect a pattern
    if (transactions.length < 3) {
      return;
    }

    // Check if subscription already exists
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        merchantName,
        status: 'ACTIVE',
      },
    });

    if (existingSubscription) {
      return;
    }

    // Analyze frequency
    const dates = transactions.map((t) => t.transactionDate);
    const frequency = this.analyzeFrequency(dates);

    if (!frequency) {
      return;
    }

    // Calculate average amount
    const amounts = transactions.map((t) => Number(t.amount));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

    // Check amount consistency (coefficient of variation)
    const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length);
    const cv = stdDev / avgAmount;

    // If amounts are consistent (CV < 0.3), likely a subscription
    if (cv < 0.3) {
      const nextBillingDate = this.calculateNextBillingDate(frequency);

      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          name: merchantName,
          merchantName,
          amount: avgAmount,
          frequency,
          status: 'ACTIVE',
          nextBillingDate,
          lastPaymentDate: dates[dates.length - 1],
          totalPaymentsCount: transactions.length,
          totalAmountPaid: amounts.reduce((sum, a) => sum + a, 0),
        },
      });

      this.logger.log(`Detected subscription: ${merchantName} (${frequency})`);

      // Send notification about new subscription
      await this.notificationService.sendSubscriptionNotification(userId, {
        name: merchantName,
        amount: avgAmount,
        nextBillingDate: nextBillingDate,
      });
    }
  }

  private analyzeFrequency(dates: Date[]): 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null {
    if (dates.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime();
      intervals.push(diff / (1000 * 60 * 60 * 24)); // Convert to days
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval <= 2) return 'DAILY';
    if (avgInterval <= 10) return 'WEEKLY';
    if (avgInterval <= 40) return 'MONTHLY';
    if (avgInterval <= 100) return 'QUARTERLY';
    return 'YEARLY';
  }

  private calculateNextBillingDate(frequency: string): Date {
    const date = new Date();

    switch (frequency) {
      case 'DAILY':
        date.setDate(date.getDate() + 1);
        break;
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'QUARTERLY':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'YEARLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date;
  }
}
