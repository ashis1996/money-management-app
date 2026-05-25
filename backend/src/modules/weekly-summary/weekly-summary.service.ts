import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';

@Injectable()
export class WeeklySummaryService {
  private readonly logger = new Logger(WeeklySummaryService.name);

  constructor(
    private prisma: PrismaService,
    private aiProxy: AiProxyService,
  ) {}

  async getOrGenerateCurrent(userId: string) {
    const { weekStart, weekEnd } = this.currentWeekRange();

    const existing = await this.prisma.weeklySummary.findUnique({
      where: { userId_weekStartDate: { userId, weekStartDate: weekStart } } as any,
    }).catch(() => null);

    if (existing) {
      return this.serialize(existing);
    }

    return this.generateForRange(userId, weekStart, weekEnd);
  }

  async generate(userId: string) {
    const { weekStart, weekEnd } = this.currentWeekRange();
    return this.generateForRange(userId, weekStart, weekEnd);
  }

  async getHistory(userId: string, limit = 12) {
    const summaries = await this.prisma.weeklySummary.findMany({
      where: { userId },
      orderBy: { weekStartDate: 'desc' },
      take: limit,
    });

    return summaries.map((s) => this.serialize(s));
  }

  async findOne(userId: string, id: string) {
    const summary = await this.prisma.weeklySummary.findFirst({
      where: { id, userId },
    });

    if (!summary) {
      throw new NotFoundException('Weekly summary not found');
    }

    return this.serialize(summary);
  }

  private async generateForRange(userId: string, weekStart: Date, weekEnd: Date) {
    // Pull this week's transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Pull previous week's for comparison
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekStart);
    prevEnd.setMilliseconds(-1);

    const prevTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: prevStart, lte: prevEnd },
      },
    });

    // Aggregate
    const totals = this.aggregate(transactions);
    const prevTotals = this.aggregate(prevTransactions);

    // Top categories & merchants
    const topCategories = this.topByGroup(transactions, 'categoryId', 5);
    const topMerchants = this.topByGroup(transactions, 'merchantName', 5);

    // Behavioral signals
    const unusual = transactions
      .filter((t) => {
        const amt = Number(t.amount);
        const avg = totals.totalSpent / Math.max(1, transactions.length);
        return t.type === 'DEBIT' && amt > avg * 4;
      })
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        merchant: t.merchantName,
        amount: Number(t.amount),
        reason: 'Unusually large compared to typical transactions',
      }));

    // Behavior flags from existing tags on transactions
    const behaviorInsights = this.computeBehaviorInsights(transactions);

    // Try to enrich with AI service for natural-language summary
    let aiSummary: string | null = null;
    let recommendations: any[] = [];
    try {
      const enriched = await this.aiProxy.callAi('/insights/spending', {
        user_id: userId,
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          type: t.type,
          category: t.categoryId,
          merchant: t.merchantName,
          date: t.transactionDate,
        })),
        period: 'week',
      });
      aiSummary = enriched?.data?.spending_analysis?.summary ?? null;
      recommendations = enriched?.data?.recommendations ?? [];
    } catch (e: any) {
      this.logger.warn(`AI summary unavailable: ${e?.message ?? 'unknown'}`);
    }

    // Upsert
    const data = {
      userId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalSpent: totals.totalSpent,
      totalIncome: totals.totalIncome,
      savingsAmount: totals.totalIncome - totals.totalSpent,
      savingsRate:
        totals.totalIncome > 0
          ? (totals.totalIncome - totals.totalSpent) / totals.totalIncome
          : 0,
      topCategories,
      topMerchants,
      unusualSpending: { items: unusual, prevTotals },
      behaviorInsights,
      aiSummary,
      recommendations,
    };

    const summary = await this.prisma.weeklySummary.upsert({
      where: { userId_weekStartDate: { userId, weekStartDate: weekStart } } as any,
      create: data as any,
      update: data as any,
    });

    return this.serialize(summary);
  }

  private aggregate(transactions: any[]) {
    let totalSpent = 0;
    let totalIncome = 0;
    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.type === 'CREDIT') totalIncome += amt;
      else if (t.type === 'DEBIT') totalSpent += amt;
    }
    return { totalSpent, totalIncome };
  }

  private topByGroup(
    transactions: any[],
    field: 'categoryId' | 'merchantName',
    limit: number,
  ) {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    for (const t of transactions) {
      if (t.type !== 'DEBIT') continue;
      const key = (t[field] as string) || 'OTHER';
      if (!map.has(key)) map.set(key, { name: key, amount: 0, count: 0 });
      const entry = map.get(key)!;
      entry.amount += Number(t.amount);
      entry.count += 1;
    }
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  private computeBehaviorInsights(transactions: any[]) {
    const lateNight = transactions.filter((t) => t.isLateNight && t.type === 'DEBIT');
    const weekend = transactions.filter((t) => t.isWeekend && t.type === 'DEBIT');
    const impulse = transactions.filter((t) => t.isImpulse && t.type === 'DEBIT');

    return {
      lateNightCount: lateNight.length,
      lateNightAmount: lateNight.reduce((s, t) => s + Number(t.amount), 0),
      weekendCount: weekend.length,
      weekendAmount: weekend.reduce((s, t) => s + Number(t.amount), 0),
      impulseCount: impulse.length,
      impulseAmount: impulse.reduce((s, t) => s + Number(t.amount), 0),
    };
  }

  /**
   * Returns the start (Monday 00:00) and end (Sunday 23:59:59.999) of the
   * current week.
   */
  private currentWeekRange(): { weekStart: Date; weekEnd: Date } {
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { weekStart, weekEnd };
  }

  private serialize(summary: any) {
    return {
      ...summary,
      totalSpent: Number(summary.totalSpent),
      totalIncome: Number(summary.totalIncome),
      savingsAmount: Number(summary.savingsAmount),
      savingsRate: Number(summary.savingsRate),
    };
  }
}
