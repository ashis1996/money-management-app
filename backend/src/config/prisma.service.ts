import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { Logger } from '../common/utils/logger';

/**
 * Models that carry a `deletedAt` column. The soft-delete middleware
 * automatically filters these out of every read/update/delete so callers
 * never accidentally see (or mutate) a tombstoned row.
 *
 * To opt OUT of the filter for a single query, set `deletedAt` explicitly
 * in your `where` clause (e.g. `deletedAt: { not: null }` to *only* see
 * deleted rows, or `deletedAt: undefined` to bypass entirely).
 */
const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Account',
  'Transaction',
  'Subscription',
  'Budget',
  'Notification',
  'Goal',
]);

/**
 * Read actions that accept a `where` clause and should filter out
 * soft-deleted rows.
 */
const READ_ACTIONS = new Set<Prisma.PrismaAction>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Write actions that mutate existing rows. We never want to silently
 * resurrect, edit, or hard-delete a tombstoned row, so the same filter
 * applies on the way in.
 */
const WRITE_ACTIONS = new Set<Prisma.PrismaAction>([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * `findUnique` / `findUniqueOrThrow` accept only unique-key filters, so we
 * can't just inject `deletedAt: null` without Prisma rejecting the query.
 * We rewrite them to `findFirst` and add the soft-delete filter alongside
 * whatever unique key the caller passed.
 */
const FIND_UNIQUE_ACTIONS = new Set<Prisma.PrismaAction>([
  'findUnique',
  'findUniqueOrThrow',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.installSoftDeleteMiddleware();
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Register a single Prisma middleware that injects `deletedAt: null` into
   * every read and write touching a soft-deletable model. This makes
   * soft-delete a system-wide invariant rather than a per-call discipline.
   *
   * NOTE: We deliberately leave `upsert` and `create` untouched.
   *   - `create` doesn't have a `where` clause; soft-delete is irrelevant.
   *   - `upsert` is used by the SMS dedup path and others where matching
   *     against a tombstoned row is the desired behavior. Forcing the
   *     filter would break those flows in surprising ways.
   *
   * Callers can still bypass per-query by explicitly setting `deletedAt`
   * in their `where` (e.g. `deletedAt: { not: null }` to query the trash).
   */
  private installSoftDeleteMiddleware(): void {
    // Prisma 5 still ships $use; the migration to $extends is a separate
    // refactor. We log once at startup so future readers know what's going
    // on if a query unexpectedly returns no rows.
    this.$use(async (params, next) => {
      const model = params.model;
      if (!model || !SOFT_DELETE_MODELS.has(model)) {
        return next(params);
      }

      // findUnique / findUniqueOrThrow → findFirst with the soft-delete filter
      // bolted on. The original unique key is preserved as part of the where.
      if (FIND_UNIQUE_ACTIONS.has(params.action)) {
        const originalWhere = params.args?.where ?? {};
        if (!('deletedAt' in originalWhere)) {
          params.action =
            params.action === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
          params.args = {
            ...params.args,
            where: { ...originalWhere, deletedAt: null },
          };
        }
        return next(params);
      }

      if (READ_ACTIONS.has(params.action) || WRITE_ACTIONS.has(params.action)) {
        const args = (params.args ??= {});
        const where = (args.where ??= {});
        if (!('deletedAt' in where)) {
          where.deletedAt = null;
        }
      }

      return next(params);
    });

    this.logger.log(
      `Soft-delete middleware installed for: ${[...SOFT_DELETE_MODELS].join(', ')}`,
    );
  }
}
