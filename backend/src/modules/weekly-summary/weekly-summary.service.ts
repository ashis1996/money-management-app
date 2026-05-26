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

    // Aggregate locally as a guaranteed-correct fallback baseline
    const totals = this.aggregate(transactions);
    const prevTotals = this.aggregate(prevTransactions);

    // Top categories & merchants (local fallback values)
    const localTopCategories = this.topByGroup(transactions, 'categoryId', 5);
    const localTopMerchants = this.topByGroup(transactions, 'merchantName', 5);

    // Behavior flags from existing tags on transactions
    const behaviorInsights = this.computeBehaviorInsights(transactions);

    // Map transactions to AI-service shape
    const txnsForAi = transactions.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      category: t.categoryId,
      merchant: t.merchantName,
      date: t.transactionDate.toISOString(),
      isImpulse: t.isImpulse,
      isLateNight: t.isLateNight,
      isWeekend: t.isWeekend,
    }));
    const prevTxnsForAi = prevTransactions.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      category: t.categoryId,
      merchant: t.merchantName,
      date: t.transactionDate.toISOString(),
    }));

    // Look up the user's archetype for personalized framing
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { archetype: true },
    });

    // Try the dedicated /insights/weekly-summary endpoint first.
    // Falls back to local aggregates if the AI service is unavailable.
    let aiSummary: string | null = null;
    let recommendations: any[] = [];
    let topCategories: any = localTopCategories;
    let topMerchants: any = localTopMerchants;
    let unusualSpending: any = null;
    let winsAndImprovements: any = null;
    let aiBehaviorInsights: any = behaviorInsights;
    let aiStats: any = null;

    try {
      const enriched: any = await this.aiProxy.getWeeklySummary(
        userId,
        weekStart,
        weekEnd,
        txnsForAi,
        prevTxnsForAi,
        user?.archetype ?? undefined,
      );
      const data = enriched?.data ?? enriched;
      if (data) {
        aiSummary = data.aiSummary ?? null;
        recommendations = data.recommendations ?? [];
        topCategories = data.topCategories ?? localTopCategories;
        topMerchants = data.topMerchants ?? localTopMerchants;
        unusualSpending = data.unusualSpending ?? null;
        winsAndImprovements = data.winsAndImprovements ?? null;
        aiBehaviorInsights = data.behaviorInsights ?? behaviorInsights;
        aiStats = data.stats ?? null;
      }
    } catch (e: any) {
      this.logger.warn(`AI weekly summary unavailable: ${e?.message ?? 'unknown'}`);
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
      unusualSpending: unusualSpending ?? { items: [], prevTotals },
      behaviorInsights: {
        ...behaviorInsights,
        ...(aiBehaviorInsights ?? {}),
        winsAndImprovements: winsAndImprovements ?? null,
        aiStats,
      },
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
