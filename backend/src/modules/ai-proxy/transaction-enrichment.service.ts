import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ActionCardService } from '../action-card/action-card.service';
import { AiProxyService } from './ai-proxy.service';

/**
 * Post-create enrichment for transactions.
 *
 * Every transaction (manual or SMS-derived) emits a `transaction.created`
 * event consumed by the RabbitMQConsumer. The consumer delegates to this
 * service which calls the AI service to:
 *
 *   1. Tag the transaction with behavioral flags
 *      (isImpulse / isLateNight / isWeekend / impulseScore / aiSuggestedCategory)
 *      → mutates the Transaction row in place.
 *   2. Recompute the user's financial health score
 *      → updates User.financialHealthScore.
 *   3. Regenerate action cards from the latest data
 *      → bulk-syncs into the ActionCard table (replaces PENDING cards).
 *
 * All three steps are independent and best-effort: if the AI service is
 * down or slow, we log and move on. The user-visible transaction is
 * already persisted by the time we get here.
 *
 * Throttling: action cards and health score recompute are heavy. The
 * `userId`-keyed maps below skip duplicate work if multiple transactions
 * land within a short window.
 */
@Injectable()
export class TransactionEnrichmentService {
  private readonly logger = new Logger(TransactionEnrichmentService.name);

  // Per-user cooldown for the heavy AI fan-outs. Behavioral tagging is
  // cheap and runs every time; action cards + health score regen run at
  // most once per user per cooldown window to avoid hammering the AI
  // service when bulk-importing SMS history.
  private readonly heavyCooldownMs = 60_000;
  private readonly lastHeavyRunAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProxy: AiProxyService,
    private readonly actionCards: ActionCardService,
  ) {}

  /**
   * Entry point for the `transaction.created` consumer.
   * Fans out to behavior tagging + (debounced) heavy enrichment.
   */
  async enrich(userId: string, transactionId: string): Promise<void> {
    // Always run lightweight behavioral tagging — cheap and per-tx accurate.
    await this.tagBehavior(userId, transactionId).catch((err) =>
      this.logger.warn(
        `Behavior tagging failed for tx=${transactionId}: ${err?.message ?? err}`,
      ),
    );

    // Debounce heavy AI work per user.
    const now = Date.now();
    const last = this.lastHeavyRunAt.get(userId) ?? 0;
    if (now - last < this.heavyCooldownMs) {
      this.logger.debug(
        `Skipping heavy enrichment for user=${userId}, cooldown active.`,
      );
      return;
    }
    this.lastHeavyRunAt.set(userId, now);

    // Fire heavy work in parallel; failures are independent.
    await Promise.allSettled([
      this.recomputeHealthScore(userId),
      this.regenerateActionCards(userId),
    ]);
  }

  /**
   * Call AI /behavior/tag-transactions for the single transaction we just
   * created and persist the resulting flags back to the row.
   */
  private async tagBehavior(userId: string, transactionId: string): Promise<void> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId, deletedAt: null },
    });
    if (!tx) {
      this.logger.debug(`tagBehavior: transaction ${transactionId} not found`);
      return;
    }

    const payload = {
      transactions: [
        {
          id: tx.id,
          amount: Number(tx.amount),
          type: tx.type,
          category: tx.categoryId,
          merchant: tx.merchantName,
          merchantName: tx.merchantName,
          description: tx.description,
          transactionDate: tx.transactionDate.toISOString(),
          date: tx.transactionDate.toISOString(),
          source: tx.source,
        },
      ],
    };

    let response: any;
    try {
      response = await this.aiProxy.callAi('/behavior/tag-transactions', payload);
    } catch (err: any) {
      this.logger.debug(
        `AI behavior tagging unavailable for tx=${transactionId}: ${err?.message ?? err}`,
      );
      return;
    }

    const tagged =
      response?.data?.transactions?.[0] ??
      response?.transactions?.[0] ??
      null;
    if (!tagged) return;

    const update: Record<string, any> = {};
    if (typeof tagged.isImpulse === 'boolean') update.isImpulse = tagged.isImpulse;
    if (typeof tagged.isLateNight === 'boolean') update.isLateNight = tagged.isLateNight;
    if (typeof tagged.isWeekend === 'boolean') update.isWeekend = tagged.isWeekend;

    // The AI service may suggest a refined category — only fill the
    // suggestion fields if they aren't already set (the SMS parser may
    // have set them). We never overwrite the user's confirmed categoryId.
    if (tagged.category && !tx.aiSuggestedCategory) {
      update.aiSuggestedCategory = tagged.category;
    }
    if (typeof tagged.impulseScore === 'number' && !tx.aiConfidence) {
      update.aiConfidence = tagged.impulseScore;
    }

    if (Object.keys(update).length === 0) return;

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: update,
    });
    this.logger.debug(
      `Tagged tx=${tx.id} with ${Object.keys(update).join(',')}`,
    );
  }

  /**
   * Recompute the user's financial health score and persist on User.
   */
  private async recomputeHealthScore(userId: string): Promise<void> {
    let response: any;
    try {
      response = await this.aiProxy.getHealthScore(userId);
    } catch (err: any) {
      this.logger.debug(
        `Health score recompute skipped for user=${userId}: ${err?.message ?? err}`,
      );
      return;
    }

    const score = this.extractNumeric(
      response?.data?.score ??
        response?.data?.overall_score ??
        response?.score ??
        response?.overall_score,
    );
    if (score === null) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: { financialHealthScore: score },
    });
    this.logger.debug(`Updated financialHealthScore for user=${userId} to ${score}`);
  }

  /**
   * Regenerate the user's action cards from the AI service and bulk-sync
   * them into the DB (replacing any PENDING cards).
   */
  private async regenerateActionCards(userId: string): Promise<void> {
    let response: any;
    try {
      response = await this.aiProxy.generateActionCards(userId);
    } catch (err: any) {
      this.logger.debug(
        `Action card regen skipped for user=${userId}: ${err?.message ?? err}`,
      );
      return;
    }

    const rawCards: any[] =
      response?.data?.cards ?? response?.cards ?? [];
    if (!Array.isArray(rawCards) || rawCards.length === 0) {
      this.logger.debug(`No action cards returned for user=${userId}`);
      return;
    }

    const cards = rawCards
      .map((c) => this.normalizeCard(c))
      .filter((c): c is NonNullable<ReturnType<typeof this.normalizeCard>> => !!c);

    if (cards.length === 0) return;

    await this.actionCards.bulkSync(userId, { cards, replacePending: true });
    this.logger.debug(`Synced ${cards.length} action cards for user=${userId}`);
  }

  /**
   * Normalize the AI service's snake_case card shape to the backend DTO.
   * Returns null if required fields are missing.
   */
  private normalizeCard(c: any) {
    if (!c?.type || !c?.title || !c?.description) return null;
    return {
      type: String(c.type),
      title: String(c.title),
      description: String(c.description),
      priority: c.priority ?? undefined,
      impactAmount:
        typeof c.impact_amount === 'number'
          ? c.impact_amount
          : typeof c.impactAmount === 'number'
            ? c.impactAmount
            : undefined,
      impactType: c.impact_type ?? c.impactType ?? undefined,
      actionData: c.action_data ?? c.actionData ?? {},
      expiresAt: c.expires_at ?? c.expiresAt ?? undefined,
    };
  }

  private extractNumeric(value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = parseFloat(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }
}
