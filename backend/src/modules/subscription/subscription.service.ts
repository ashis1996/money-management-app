import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  DetectedSubscriptionDto,
  SubscriptionFrequency,
} from '@money-management/shared/dto';
import { SUBSCRIPTION_DEFAULTS } from '@money-management/shared/constants';
import { Logger } from '../../common/utils/logger';

type FrequencyValue = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private rabbitMQ: RabbitMQService,
  ) {}

  async create(userId: string, dto: CreateSubscriptionDto) {
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        name: dto.name,
        merchantName: dto.merchantName ?? dto.name,
        amount: dto.amount,
        frequency: dto.frequency as any,
        categoryId: dto.categoryId,
        notes: dto.notes,
        nextBillingDate: dto.nextBillingDate ? new Date(dto.nextBillingDate as any) : null,
      },
    });

    return subscription;
  }

  async findAll(userId: string, status?: string) {
    const where: any = { userId, deletedAt: null };
    if (status) where.status = status;

    return this.prisma.subscription.findMany({
      where,
      orderBy: { nextBillingDate: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async update(userId: string, id: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const updateData: any = { ...dto };
    if (dto.nextBillingDate) {
      updateData.nextBillingDate = new Date(dto.nextBillingDate as any);
    }

    return this.prisma.subscription.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(userId: string, id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.subscription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Subscription deleted successfully' };
  }

  async detectSubscriptions(userId: string): Promise<DetectedSubscriptionDto[]> {
    this.logger.log(`Starting subscription detection for user ${userId}`);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'DEBIT',
        deletedAt: null,
      },
      orderBy: { transactionDate: 'asc' },
    });

    const merchantGroups = new Map<string, any[]>();
    transactions.forEach((t) => {
      if (!t.merchantName) return;
      const key = t.merchantName.toLowerCase().trim();
      if (!merchantGroups.has(key)) merchantGroups.set(key, []);
      merchantGroups.get(key)!.push(t);
    });

    const detected: DetectedSubscriptionDto[] = [];

    for (const [merchant, txns] of merchantGroups.entries()) {
      if (txns.length < SUBSCRIPTION_DEFAULTS.DETECTION_THRESHOLD) continue;

      const frequency = this.analyzeFrequency(txns.map((t) => t.transactionDate));
      if (!frequency) continue;

      const avgAmount = txns.reduce((sum, t) => sum + Number(t.amount), 0) / txns.length;
      const confidence = this.calculateConfidence(txns, frequency);
      if (confidence < 0.5) continue;

      detected.push({
        merchant,
        amount: avgAmount,
        frequency,
        confidence,
        transactionIds: txns.map((t) => t.id),
        firstTransactionDate: txns[0].transactionDate,
        lastTransactionDate: txns[txns.length - 1].transactionDate,
      });
    }

    this.logger.log(`Detected ${detected.length} potential subscriptions`);
    return detected;
  }

  private analyzeFrequency(dates: Date[]): FrequencyValue | null {
    if (dates.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime();
      intervals.push(diff / (1000 * 60 * 60 * 24));
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval <= 2) return 'DAILY';
    if (avgInterval <= 10) return 'WEEKLY';
    if (avgInterval <= 40) return 'MONTHLY';
    if (avgInterval <= 100) return 'QUARTERLY';
    return 'YEARLY';
  }

  private calculateConfidence(transactions: any[], _frequency: string): number {
    if (transactions.length < SUBSCRIPTION_DEFAULTS.DETECTION_THRESHOLD) return 0;

    let confidence = 0.5;
    confidence += Math.min(transactions.length * 0.05, 0.2);

    const amounts = transactions.map((t) => Number(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length,
    );
    const cv = stdDev / avgAmount;

    if (cv < 0.1) confidence += 0.2;
    else if (cv < 0.2) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  async saveDetectedSubscriptions(userId: string, detected: DetectedSubscriptionDto[]) {
    const saved = [];

    for (const sub of detected) {
      const existing = await this.prisma.subscription.findFirst({
        where: {
          userId,
          merchantName: { contains: sub.merchant, mode: 'insensitive' as const },
          deletedAt: null,
        },
      });

      if (existing) {
        saved.push(
          await this.prisma.subscription.update({
            where: { id: existing.id },
            data: {
              amount: sub.amount,
              frequency: sub.frequency as any,
            },
          }),
        );
      } else {
        const nextBillingDate = this.calculateNextBillingDate(sub.frequency as string);
        saved.push(
          await this.prisma.subscription.create({
            data: {
              userId,
              name: sub.merchant,
              merchantName: sub.merchant,
              amount: sub.amount,
              frequency: sub.frequency as any,
              status: 'ACTIVE',
              nextBillingDate,
            },
          }),
        );
      }
    }

    for (const sub of saved) {
      await this.rabbitMQ.publishSubscriptionDetected({
        subscriptionId: sub.id,
        userId,
        merchant: sub.merchantName,
        amount: Number(sub.amount),
      });
    }

    return saved;
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

  async getUpcomingPayments(userId: string, days: number = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.prisma.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'ACTIVE',
        nextBillingDate: { lte: endDate },
      },
      orderBy: { nextBillingDate: 'asc' },
    });
  }

  async getSummary(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
    });

    const totalMonthlySpend = subscriptions.reduce((sum, sub) => {
      let monthlyAmount = Number(sub.amount);
      switch (sub.frequency) {
        case 'DAILY':
          monthlyAmount *= 30;
          break;
        case 'WEEKLY':
          monthlyAmount *= 4;
          break;
        case 'QUARTERLY':
          monthlyAmount /= 3;
          break;
        case 'YEARLY':
          monthlyAmount /= 12;
          break;
      }
      return sum + monthlyAmount;
    }, 0);

    const upcomingPayments = await this.getUpcomingPayments(userId, 7);

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.length,
      totalMonthlySpend,
      upcomingPayments: upcomingPayments.map((p) => ({
        name: p.name,
        amount: Number(p.amount),
        dueDate: p.nextBillingDate,
      })),
    };
  }

  async cancelSubscription(userId: string, id: string) {
    return this.update(userId, id, { status: 'CANCELLED' as any });
  }

  async pauseSubscription(userId: string, id: string) {
    return this.update(userId, id, { status: 'PAUSED' as any });
  }

  async resumeSubscription(userId: string, id: string) {
    return this.update(userId, id, { status: 'ACTIVE' as any });
  }
}
