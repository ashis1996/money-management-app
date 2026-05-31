import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { SubscriptionService } from './subscription.service';
import { Logger } from '../../common/utils/logger';

/**
 * Weekly full-scan subscription detection.
 *
 * The per-transaction consumer in `RabbitMQConsumer` is intentionally
 * cheap-and-debounced: it runs the merchant-pattern check at most once
 * per (user, merchant) per hour, so a backfill of a year of SMS doesn't
 * blow up. That's good for ingest latency, but it can miss patterns that
 * only become visible across the *whole* transaction history of a user
 * (e.g. quarterly subscriptions, slow-rolling monthly upticks).
 *
 * This cron picks up that long-tail every Sunday at 03:00 UTC. It walks
 * users in pages, runs `subscriptionService.detectSubscriptions` for
 * each one (which scans merchant histories and computes frequency /
 * confidence / amount-stability), and persists net-new subscriptions
 * via `saveDetectedSubscriptions`.
 *
 * The schedule was picked to be off-peak across IN/US working hours and
 * to land outside any normal user-driven traffic window so the backend
 * is otherwise quiet while it churns.
 */
@Injectable()
export class SubscriptionScanCron {
  private readonly logger = new Logger(SubscriptionScanCron.name);

  // Page through users so a 100k-user deployment doesn't try to load
  // them all into memory or hold a single transaction open for hours.
  private readonly USERS_PER_BATCH = 200;

  // Cap per-run wall time. If a single user's detect takes pathologically
  // long, we move on so the cron isn't blocked indefinitely.
  private readonly PER_USER_TIMEOUT_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /**
   * Sundays at 03:00 server time. The schedule is fixed (not env-driven)
   * deliberately — operators who need to disable it in dev can use
   * `SCHEDULE_DISABLED=true` (the ScheduleModule docs cover the global
   * toggle) rather than reading a more granular env per cron.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyScan(): Promise<void> {
    this.logger.log('Starting weekly subscription scan');
    const startedAt = Date.now();

    let processed = 0;
    let detected = 0;
    let cursor: { id: string } | undefined;

    // Page through active users. We deliberately ignore the soft-delete
    // middleware for this cron path — paged users only need the id.
    // findMany with our middleware filters deletedAt: null automatically,
    // which is what we want.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
        take: this.USERS_PER_BATCH,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: { id: true },
      });

      if (users.length === 0) break;

      for (const u of users) {
        try {
          const detectedForUser = await this.runForUserWithTimeout(u.id);
          processed += 1;
          detected += detectedForUser;
        } catch (err: any) {
          this.logger.warn(`Subscription scan failed for user=${u.id}: ${err?.message ?? err}`);
        }
      }

      cursor = { id: users[users.length - 1].id };
      if (users.length < this.USERS_PER_BATCH) break;
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    this.logger.log(
      `Weekly subscription scan complete: users=${processed} newSubs=${detected} elapsed=${elapsedSec}s`,
    );
  }

  /**
   * Run detection for one user with a hard wall-clock timeout. The
   * SubscriptionService.detectSubscriptions call is CPU-bound (in-process
   * statistics on transaction history) so a slow user usually means a
   * pathological dataset, not a broker hang. Returning 0 on timeout keeps
   * the cron moving.
   */
  private async runForUserWithTimeout(userId: string): Promise<number> {
    const detectionPromise = (async () => {
      const detected = await this.subscriptions.detectSubscriptions(userId);
      if (detected.length === 0) return 0;
      const saved = await this.subscriptions.saveDetectedSubscriptions(userId, detected);
      return saved.length;
    })();

    return Promise.race([
      detectionPromise,
      new Promise<number>((_, reject) =>
        setTimeout(
          () => reject(new Error(`subscription scan timeout after ${this.PER_USER_TIMEOUT_MS}ms`)),
          this.PER_USER_TIMEOUT_MS,
        ),
      ),
    ]);
  }
}
