import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../config/prisma.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { NotificationService } from '../../modules/notification/notification.service';
import { TransactionEnrichmentService } from '../../modules/ai-proxy/transaction-enrichment.service';
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

  /**
   * Per-merchant cooldown for subscription pattern detection. Without this
   * a backfill of 1 year of SMS could fire detection O(N²) times — every
   * incoming transaction re-fetches the merchant's full history and
   * recomputes std-dev / CV / next-billing-date.
   *
   * The cooldown lives in the shared cache (Redis when configured) so
   * every backend replica sees the same window. TTL is 1h: long enough
   * to absorb a backfill, short enough that legitimate user behavior
   * changes (e.g. switching plans) get re-detected within the day.
   */
  private static readonly SUB_DETECT_COOLDOWN_SECONDS = 60 * 60;

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private enrichment: TransactionEnrichmentService,
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async onModuleInit() {
    this.logger.log('RabbitMQ Consumer initialized');
  }

  /**
   * NOTE: `sms.received` no longer has a publisher.
   *
   * The original design had SmsService publish `sms.received` AND
   * synchronously create a Transaction, while this consumer ALSO created a
   * Transaction from the same SMS — a guaranteed double-write race. The
   * dedup key on Transaction (`userId, externalReferenceId`) papered over
   * the symptom but left two parser invocations and two notification
   * round-trips per SMS.
   *
   * The single source of truth is now the synchronous path in
   * SmsService.ingestSms, which upserts the Transaction by dedup hash and
   * publishes a single `transaction.created` event. The handler that used
   * to live here has been deleted intentionally; do not re-introduce it.
   */

  /**
   * Consumes TRANSACTION_CREATED events.
   *
   * Fans out three concerns, each independent:
   *   1. Transaction notification (existing behavior)
   *   2. Subscription pattern detection (cooldown-throttled)
   *   3. AI enrichment — behavior tagging, health-score recompute,
   *      action card regeneration. See TransactionEnrichmentService.
   */
  @MessagePattern('transaction.created')
  async handleTransactionCreated(
    @Payload()
    message: RabbitMQMessage<{
      transactionId: string;
      userId: string;
      amount: number;
      category: string;
    }>,
  ) {
    this.logger.log(`Processing transaction: ${message.data.transactionId}`);

    const { transactionId, userId } = message.data;

    // Fan out in parallel; failures in one branch must not break the others.
    const transactionPromise = this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    const tasks: Promise<unknown>[] = [
      // Branch A: notifications + subscription pattern detection
      transactionPromise.then(async (transaction) => {
        if (!transaction) return;

        try {
          await this.notificationService.sendTransactionNotification(userId, {
            amount: Number(transaction.amount),
            merchant: transaction.merchantName || undefined,
            type: transaction.type,
            category: transaction.categoryId || undefined,
          });
        } catch (err: any) {
          this.logger.warn(
            `Notification failed for tx=${transactionId}: ${err?.message ?? err}`,
          );
        }

        if (transaction.type === 'DEBIT' && transaction.merchantName) {
          try {
            await this.maybeCheckForSubscriptionPattern(userId, transaction.merchantName);
          } catch (err: any) {
            this.logger.warn(
              `Subscription pattern check failed for tx=${transactionId}: ${err?.message ?? err}`,
            );
          }
        }
      }),

      // Branch B: AI enrichment (behavior tag + heavy recompute, debounced)
      this.enrichment.enrich(userId, transactionId).catch((err: any) =>
        this.logger.warn(
          `AI enrichment failed for tx=${transactionId}: ${err?.message ?? err}`,
        ),
      ),
    ];

    await Promise.allSettled(tasks);
  }

  /**
   * Consumes SUBSCRIPTION_DETECTED events
   * Sends notification to user about new subscription
   */
  @MessagePattern('subscription.detected')
  async handleSubscriptionDetected(
    @Payload()
    message: RabbitMQMessage<{
      subscriptionId: string;
      userId: string;
      merchant: string;
      amount: number;
    }>,
  ) {
    this.logger.log(`Processing subscription detection: ${message.data.subscriptionId}`);

    try {
      const { subscriptionId, userId } = message.data;

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
    } catch (error: any) {
      this.logger.error(
        `Failed to process subscription detection ${message.data.subscriptionId}: ${error?.message ?? error}`,
      );
    }
  }

  /**
   * Consumes NOTIFICATION_REQUEST events
   * Creates notifications in the database
   */
  @MessagePattern('notifications')
  async handleNotificationRequest(
    @Payload()
    message: RabbitMQMessage<{
      userId: string;
      type: string;
      title: string;
      body: string;
    }>,
  ) {
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
    } catch (error: any) {
      this.logger.error(`Failed to create notification: ${error?.message ?? error}`);
    }
  }

  /**
   * Distributed cooldown around `checkForSubscriptionPattern`.
   *
   * For a given (userId, merchant) pair we run detection at most once per
   * `SUB_DETECT_COOLDOWN_SECONDS`. The cache.set acts as the lock; a
   * concurrent racer that finds the key already set bails out cheaply.
   *
   * The race window between get-then-set is small and harmless: at worst
   * two pods both run detection in parallel, which is still O(merchants)
   * instead of the previous O(transactions).
   */
  private async maybeCheckForSubscriptionPattern(
    userId: string,
    merchantName: string,
  ): Promise<void> {
    const key = this.subscriptionDetectKey(userId, merchantName);

    let alreadyRunning: string | null | undefined = undefined;
    try {
      alreadyRunning = await this.cache.get<string>(key);
    } catch (err: any) {
      // Cache miss / outage => fall through and run detection. Better to
      // do a bit of redundant work than to skip detection entirely.
      this.logger.debug(
        `Subscription cooldown lookup failed for ${key}: ${err?.message ?? err}`,
      );
    }
    if (alreadyRunning) {
      this.logger.debug(
        `Subscription detection skipped for user=${userId} merchant=${merchantName}: cooldown active.`,
      );
      return;
    }

    // Set the cooldown FIRST, then run detection. If detection fails, the
    // cooldown still expires after TTL — we don't need to clean it up.
    try {
      await this.cache.set(key, '1', RabbitMQConsumer.SUB_DETECT_COOLDOWN_SECONDS * 1000);
    } catch (err: any) {
      this.logger.debug(
        `Subscription cooldown set failed for ${key}: ${err?.message ?? err}`,
      );
    }

    await this.checkForSubscriptionPattern(userId, merchantName);
  }

  private subscriptionDetectKey(userId: string, merchantName: string): string {
    // Lower-case the merchant so "Netflix" and "netflix" share a cooldown.
    return `subscription:detect:${userId}:${merchantName.toLowerCase().trim()}`;
  }

  /**
   * Check if a merchant transaction pattern indicates a subscription.
   * Always invoked through `maybeCheckForSubscriptionPattern` so the
   * cooldown is enforced.
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
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length,
    );
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

      // Suppress unused-var lint by referencing the freshly-created row.
      void subscription;
    }
  }

  private analyzeFrequency(
    dates: Date[],
  ): 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null {
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
