import { HttpService } from '@nestjs/axios';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { PrismaService } from '../../config/prisma.service';

/**
 * Thin client around the FastAPI AI service. Aggregates the data the AI
 * service needs from the database, then forwards the request and returns
 * the response.
 *
 * Hot reads (dashboard / health-score / leaks / behavior / archetype) are
 * cached per-user via the shared cache (Redis when configured). The
 * cache TTL is short — 60-300s depending on volatility — so callers see
 * freshly-enriched data within a minute of a transaction landing, but a
 * burst of mobile pull-to-refreshes only hits the AI service once.
 *
 * Cache invalidation lives in `invalidateUser()`, which is called by the
 * transaction-enrichment consumer right after a recompute lands. Without
 * that hook, users would see stale dashboards for a full TTL after a new
 * transaction.
 */
@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiBaseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly internalToken?: string;

  // Per-feature TTLs in seconds. Picked to slightly exceed the
  // TransactionEnrichmentService heavy-cooldown (60s) so a fresh
  // transaction triggers exactly one recompute that everyone benefits
  // from for the rest of the window.
  private static readonly TTL = {
    dashboard: 90,
    healthScore: 300,
    leaks: 300,
    behavior: 300,
    archetype: 600,
  };

  // Hard cap on how many transactions we ever ship to the AI service.
  // Beyond this we'd blow the JSON payload past anything reasonable; the
  // AI service models don't benefit from arbitrarily long history. We
  // page the DB read so the LIMIT is enforced predictably regardless of
  // index plan, and so we never silently truncate when a user has more.
  private static readonly TX_PAGE_SIZE = 1000;
  private static readonly TX_HARD_CAP = 5000;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    const rawUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000/api/v1';
    this.aiBaseUrl = this.normalizeBaseUrl(rawUrl);
    this.requestTimeoutMs = parseInt(
      this.config.get<string>('AI_TIMEOUT_MS') ?? '30000',
      10,
    );

    // Shared secret used to authenticate as the trusted backend when calling
    // the AI service. Mirrored from the AI service's INTERNAL_API_TOKEN env
    // var. Optional in development; required in production by the AI service.
    this.internalToken = this.config.get<string>('INTERNAL_API_TOKEN') ?? undefined;
    if (
      !this.internalToken &&
      this.config.get<string>('NODE_ENV', 'development') === 'production'
    ) {
      this.logger.warn(
        'INTERNAL_API_TOKEN is not set on the backend in production. Calls to the AI ' +
          'service will be rejected unless the AI service is also unauthenticated.',
      );
    }
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
    const headers: Record<string, string> = {};
    if (this.internalToken) {
      headers['X-Internal-Token'] = this.internalToken;
    }
    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(url, body, { headers }).pipe(
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

  /**
   * Read-through cache helper. cache-manager v5's `wrap` API has been
   * brittle across redis-store versions, so we do the get/set dance
   * explicitly. A failed cache read NEVER blocks the underlying call;
   * we just degrade to the upstream AI service.
   */
  private async withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    let cached: T | undefined | null = undefined;
    try {
      cached = await this.cache.get<T>(key);
    } catch (err: any) {
      this.logger.debug(`Cache GET failed for ${key}: ${err?.message ?? err}`);
    }
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await fn();

    try {
      // cache-manager v5's `set` accepts ttl in milliseconds; redis-store
      // expects the same. We pass ms to be unambiguous.
      await this.cache.set(key, value, ttlSeconds * 1000);
    } catch (err: any) {
      this.logger.debug(`Cache SET failed for ${key}: ${err?.message ?? err}`);
    }
    return value;
  }

  /**
   * Drop every cached AI response for a user. Called by
   * TransactionEnrichmentService after a recompute lands so the next
   * dashboard read sees fresh data within the next request, not after the
   * full TTL.
   */
  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      this.dashboardKey(userId),
      this.healthScoreKey(userId),
      this.leaksKey(userId),
      this.archetypeKey(userId),
    ];
    // behavior is parameterised by `days`; we don't know which window the
    // user last queried, so we don't preemptively bust those keys. They'll
    // expire naturally on their (300s) TTL.
    await Promise.all(
      keys.map((k) =>
        this.cache.del(k).catch((err: any) =>
          this.logger.debug(`Cache DEL failed for ${k}: ${err?.message ?? err}`),
        ),
      ),
    );
  }

  // ============================================================
  // High-level methods that aggregate data + call the AI service
  // ============================================================

  async getDashboard(userId: string) {
    return this.withCache(this.dashboardKey(userId), AiProxyService.TTL.dashboard, async () => {
      const ctx = await this.buildUserContext(userId);
      return this.callAi('/dashboard/personalized', ctx);
    });
  }

  async getHealthScore(userId: string) {
    return this.withCache(
      this.healthScoreKey(userId),
      AiProxyService.TTL.healthScore,
      async () => {
        const ctx = await this.buildUserContext(userId);
        return this.callAi('/health-score/calculate', ctx);
      },
    );
  }

  async getLeaks(userId: string) {
    return this.withCache(this.leaksKey(userId), AiProxyService.TTL.leaks, async () => {
      const ctx = await this.buildUserContext(userId);
      return this.callAi('/leaks/detect', ctx);
    });
  }

  async analyzeBehavior(userId: string, periodDays = 30) {
    return this.withCache(
      `ai:behavior:${userId}:${periodDays}`,
      AiProxyService.TTL.behavior,
      async () => {
        const ctx = await this.buildUserContext(userId, periodDays);
        return this.callAi('/behavior/analyze', { ...ctx, period_days: periodDays });
      },
    );
  }

  async getArchetype(userId: string) {
    return this.withCache(this.archetypeKey(userId), AiProxyService.TTL.archetype, async () => {
      const ctx = await this.buildUserContext(userId);
      return this.callAi('/profile/archetype', ctx);
    });
  }

  async generateActionCards(userId: string) {
    // Action cards are explicitly invalidated by enrichment; we don't
    // also cache them here because the consumer always wants fresh ones
    // when it bulk-syncs.
    const ctx = await this.buildUserContext(userId);
    const response = await this.callAi<any>('/action-cards/generate', { context: ctx });
    return response;
  }

  async ask(userId: string, query: string) {
    // Free-form Q&A — never cached; every query is unique and the user
    // expects the answer to reflect the current state.
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
  // Cache key helpers — keep these in one place so invalidateUser()
  // and the readers can never disagree.
  // ============================================================

  private dashboardKey(userId: string): string {
    return `ai:dashboard:${userId}`;
  }
  private healthScoreKey(userId: string): string {
    return `ai:health-score:${userId}`;
  }
  private leaksKey(userId: string): string {
    return `ai:leaks:${userId}`;
  }
  private archetypeKey(userId: string): string {
    return `ai:archetype:${userId}`;
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

  /**
   * Page through the user's recent transactions in chunks rather than
   * trusting Prisma to honour a 1000-row LIMIT silently.
   *
   * Previously we did `findMany({ ..., take: 1000 })` which silently
   * dropped data for power users with > 1000 transactions in the window.
   * Now we page in `TX_PAGE_SIZE` chunks and stop when either:
   *
   *   - the page is short (no more rows), or
   *   - we've collected `TX_HARD_CAP` rows (degenerate user / wide window).
   *
   * The hard cap is intentional: the AI service models tank on multi-MB
   * payloads and don't benefit from years of history. We log a warning
   * when we hit it so power-user behaviour is at least visible.
   */
  private async fetchTransactions(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const collected: any[] = [];
    let cursor: { id: string } | undefined;

    while (collected.length < AiProxyService.TX_HARD_CAP) {
      const batch = await this.prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          transactionDate: { gte: since },
        },
        // Stable sort: transactionDate desc with id as tiebreaker so the
        // cursor is unambiguous even when many rows share a timestamp.
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        take: AiProxyService.TX_PAGE_SIZE,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });

      if (batch.length === 0) break;
      collected.push(...batch);
      if (batch.length < AiProxyService.TX_PAGE_SIZE) break;

      cursor = { id: batch[batch.length - 1].id };
    }

    if (collected.length >= AiProxyService.TX_HARD_CAP) {
      this.logger.warn(
        `fetchTransactions hit TX_HARD_CAP (${AiProxyService.TX_HARD_CAP}) for user=${userId} ` +
          `over ${days}d. Some history was excluded from the AI payload.`,
      );
    }

    return collected.map((t) => ({
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
