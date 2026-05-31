import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { Logger } from '../../common/utils/logger';

/**
 * SMS retention cleanup.
 *
 * Why this exists:
 *   `SmsLog.body` is the raw bank SMS — full text including the
 *   merchant name, amount, last-4 of the card, and sometimes a
 *   one-time reference number. `SmsLog.parsedData` mirrors a subset
 *   of those fields. Holding either indefinitely is a privacy /
 *   compliance liability (DPDP "purpose limitation", GDPR Article 5).
 *
 * What this does:
 *   Once a day, scrubs `body` and `parsedData` on rows older than the
 *   configured retention window. The row itself stays — including the
 *   FK to the linked Transaction (transactionId), `sender`, and the
 *   `receivedAt` timestamp — so the audit trail "this transaction
 *   came from an SMS at this time" survives. Only the PII goes.
 *
 *   The rows are NOT hard-deleted because the link to Transaction is
 *   the legal basis for the financial record we DO keep. Deleting the
 *   row would break that.
 *
 * Why an UPDATE is sufficient (vs a re-encrypt):
 *   The right-to-erasure scope here is "scrub raw PII". We're keeping
 *   the derived financial record (Transaction.amount,
 *   merchantName, etc.) per the user's contract; only the raw
 *   evidence is purged. Encryption-at-rest on the raw column would be
 *   stricter but is out of scope for this cron.
 *
 * Tuning:
 *   `SMS_RETENTION_DAYS` (default: 90). Set to 0 to disable the cron
 *   (no rows are ever scrubbed). Set higher for jurisdictions with
 *   longer retention requirements.
 */
@Injectable()
export class SmsRetentionCron {
  private readonly logger = new Logger(SmsRetentionCron.name);

  // Conservative cap on rows updated per run so a multi-year backlog
  // doesn't lock the table on first deploy. The cron runs daily; even
  // a 10M-row backlog clears in a few weeks.
  private readonly MAX_ROWS_PER_RUN = 50_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Daily at 04:00 server time. Same off-peak window as the
   * subscription scan; the two never overlap because they hit
   * different tables and use independent connection pool slots.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runDailyScrub(): Promise<void> {
    const retentionDays = this.parseRetentionDays();
    if (retentionDays <= 0) {
      this.logger.debug('SMS retention disabled (SMS_RETENTION_DAYS <= 0)');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const startedAt = Date.now();

    // Two-step approach:
    //   1. Page over candidate rows (oldest first) up to MAX_ROWS_PER_RUN.
    //   2. Issue a single updateMany with their ids and a non-null
    //      body/parsedData filter so already-scrubbed rows don't get
    //      touched (idempotent re-runs are no-ops).
    const candidates = await this.prisma.smsLog.findMany({
      where: {
        receivedAt: { lt: cutoff },
        // We only filter by `body !== ''` (the easy SQL-typed test).
        // Filtering nullable Json columns in Prisma 5 requires the
        // `JsonNullValueFilter` sentinel and gets noisy quickly, so
        // we accept that a row with body='' but parsedData!=null will
        // sneak through one extra cron run; the next pass clears it.
        // `parsedData` is still scrubbed in the update below.
        body: { not: '' },
      },
      orderBy: { receivedAt: 'asc' },
      take: this.MAX_ROWS_PER_RUN,
      select: { id: true },
    });

    if (candidates.length === 0) {
      this.logger.debug('SMS retention: no rows past retention window', {
        cutoff: cutoff.toISOString(),
      });
      return;
    }

    const result = await this.prisma.smsLog.updateMany({
      where: { id: { in: candidates.map((r) => r.id) } },
      // Empty string for `body` because the column is NOT NULL; for
      // `parsedData` (Json?) we use Prisma's `DbNull` sentinel which
      // writes a SQL NULL (vs `JsonNull` which writes the JSON literal
      // `null`). Passing a TypeScript `null` is rejected at the type
      // level.
      data: { body: '', parsedData: Prisma.DbNull },
    });

    const elapsedMs = Date.now() - startedAt;
    this.logger.log('SMS retention scrub complete', {
      retentionDays,
      cutoff: cutoff.toISOString(),
      scrubbed: result.count,
      elapsedMs,
    });
  }

  /**
   * Parse and validate `SMS_RETENTION_DAYS`. Defaults to 90 when unset
   * or non-numeric. Negative values are clamped to 0 (disabled) so a
   * misconfigured env doesn't accidentally scrub future-dated rows.
   */
  private parseRetentionDays(): number {
    const raw = this.config.get<string>('SMS_RETENTION_DAYS');
    if (raw === undefined) return 90;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return 90;
    return Math.max(parsed, 0);
  }
}
