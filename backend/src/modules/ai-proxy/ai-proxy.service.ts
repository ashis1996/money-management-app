import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { PrismaService } from '../../config/prisma.service';

/**
 * Thin client around the FastAPI AI service. Aggregates the data the AI service
 * needs from the database, then forwards the request and returns the response.
 */
@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiBaseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const rawUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000/api/v1';
    this.aiBaseUrl = this.normalizeBaseUrl(rawUrl);
    this.requestTimeoutMs = parseInt(this.config.get<string>('AI_TIMEOUT_MS') ?? '30000', 10);
  }

  /**
   * Tolerate older env values that pointed at just the host (e.g.
   * `http://ai-service:8000`) by appending the AI service's `/api/v1`
   * prefix when it's missing. Trailing slashes are stripped so callers
   * can pass `/dashboard/personalized` without doubling separators.
   */
  private normalizeBaseUrl(raw: string): string {
    let url = raw.trim().replace(/\/+$/, '');
    if (!/\/api\/v\d+/i.test(url)) {
      url = `${url}/api/v1`;
    }
    return url;
  }

  /**
   * Generic helper to POST to the AI service.
   */
  async callAi<T = any>(path: string, body: any): Promise<T> {
    const url = `${this.aiBaseUrl}${path}`;
    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(url, body).pipe(
          timeout(this.requestTimeoutMs),
          catchError((err) => {
            this.logger.error(`AI call failed: ${path} - ${err?.message}`);
            return throwError(() => err);
          }),
        ),
      );
      return data;
    } catch (err: any) {
      throw new ServiceUnavailableException(
        `AI service is unavailable: ${err?.message ?? 'unknown error'}`,
      );
    }
  }

  // ============================================================
  // High-level methods that aggregate data + call the AI service
  // ============================================================

  async getDashboard(userId: string) {
    const ctx = await this.buildUserContext(userId);
    return this.callAi('/dashboard/personalized', ctx);
  }

  async getHealthScore(userId: string) {
    const ctx = await this.buildUserContext(userId);
    return this.callAi('/health-score/calculate', ctx);
  }

  async getLeaks(userId: string) {
    const ctx = await this.buildUserContext(userId);
    return this.callAi('/leaks/detect', ctx);
  }

  async analyzeBehavior(userId: string, periodDays = 30) {
    const ctx = await this.buildUserContext(userId, periodDays);
    return this.callAi('/behavior/analyze', { ...ctx, period_days: periodDays });
  }

  async getArchetype(userId: string) {
    const ctx = await this.buildUserContext(userId);
    return this.callAi('/profile/archetype', ctx);
  }

  async generateActionCards(userId: string) {
    const ctx = await this.buildUserContext(userId);
    const response = await this.callAi<any>('/action-cards/generate', { context: ctx });
    return response;
  }

  async ask(userId: string, query: string) {
    const ctx = await this.buildUserContext(userId);
    return this.callAi('/assistant/query', {
      user_id: userId,
      query,
      context: ctx,
    });
  }

  async getWeeklySummary(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
    transactions: any[],
    previousTransactions: any[],
    archetype?: string,
  ) {
    const [subscriptions, budgets, goals] = await Promise.all([
      this.fetchSubscriptions(userId),
      this.fetchBudgets(userId),
      this.fetchGoals(userId),
    ]);

    return this.callAi('/insights/weekly-summary', {
      user_id: userId,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      transactions,
      previous_transactions: previousTransactions,
      subscriptions,
      budgets,
      goals,
      archetype: archetype ?? null,
    });
  }

  async parseSms(body: string, sender: string, timestamp?: string) {
    return this.callAi('/sms/parse', {
      body,
      sender,
      timestamp: timestamp ?? new Date().toISOString(),
    });
  }

  async detectSubscriptions(userId: string) {
    const txns = await this.fetchTransactions(userId, 90);
    return this.callAi('/subscriptions/detect', {
      user_id: userId,
      transactions: txns,
    });
  }

  // ============================================================
  // Context builders
  // ============================================================

  private async buildUserContext(userId: string, days = 30) {
    const [transactions, subscriptions, budgets, goals] = await Promise.all([
      this.fetchTransactions(userId, days),
      this.fetchSubscriptions(userId),
      this.fetchBudgets(userId),
      this.fetchGoals(userId),
    ]);

    return {
      user_id: userId,
      transactions,
      subscriptions,
      budgets,
      goals,
    };
  }

  private async fetchTransactions(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const txns = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: since },
      },
      orderBy: { transactionDate: 'desc' },
      take: 1000,
    });

    return txns.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      category: t.categoryId,
      categoryName: t.categoryId,
      merchant: t.merchantName,
      description: t.description,
      date: t.transactionDate.toISOString(),
      transactionDate: t.transactionDate.toISOString(),
      source: t.source,
      isImpulse: t.isImpulse,
      isLateNight: t.isLateNight,
      isWeekend: t.isWeekend,
    }));
  }

  private async fetchSubscriptions(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, deletedAt: null },
    });
    return subs.map((s) => ({
      id: s.id,
      name: s.name,
      merchantName: s.merchantName,
      amount: Number(s.amount),
      currency: s.currency,
      frequency: s.frequency,
      status: s.status,
      nextBillingDate: s.nextBillingDate?.toISOString() ?? null,
      isLowUsage: s.isLowUsage,
      isDuplicate: s.isDuplicate,
      priceIncreased: s.priceIncreased,
      priceIncreasePercent: s.priceIncreasePercent ? Number(s.priceIncreasePercent) : null,
      originalAmount: s.originalAmount ? Number(s.originalAmount) : null,
      usageScore: s.usageScore ? Number(s.usageScore) : null,
    }));
  }

  private async fetchBudgets(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, deletedAt: null, isActive: true },
    });
    return budgets.map((b) => ({
      id: b.id,
      name: b.name,
      categoryId: b.categoryId,
      amountLimit: Number(b.amountLimit),
      amountSpent: Number(b.amountSpent),
      period: b.period,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate?.toISOString() ?? null,
    }));
  }

  private async fetchGoals(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, deletedAt: null },
    });
    return goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      targetDate: g.targetDate?.toISOString() ?? null,
      isCompleted: g.isCompleted,
    }));
  }
}
