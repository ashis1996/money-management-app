import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../config/prisma.service';
import { Logger } from '../../common/utils/logger';

/**
 * Canonical actions written to the AuditLog table. Kept as a string
 * union (not a Prisma enum) because the table has supported open-ended
 * action strings since the schema was first written and tightening it
 * now would force a migration with backfill. The union here is the
 * agreed-upon catalog every caller should use.
 */
export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_REGISTER'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGOUT_ALL'
  | 'AUTH_REFRESH'
  | 'USER_DELETE_SELF'
  | 'USER_DATA_EXPORT'
  | 'USER_PASSWORD_CHANGED';

export interface AuditEvent {
  /** Acting user, if any. Failed logins / unauthenticated calls pass null. */
  userId: string | null;
  action: AuditAction;
  /** Free-form domain object the action applies to (e.g. 'User', 'RefreshToken'). */
  entityType: string;
  /** Optional id of the entity. */
  entityId?: string | null;
  /** Snapshot fields. Both are JSON in the DB; pino-redact strips PII paths. */
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /**
   * Express request used to derive ip + user-agent. Optional so this
   * service can also be called from non-HTTP contexts (cron jobs,
   * RabbitMQ consumers).
   */
  request?: Request;
}

/**
 * Centralized audit-log writer.
 *
 * Why this exists:
 *   The AuditLog model has been in the schema since v1 but no service
 *   ever wrote to it. Compliance frameworks (SOC2, ISO 27001) and
 *   regulators (DPDP / GDPR) require a tamper-evident record of
 *   sensitive identity events: who logged in / out / changed password
 *   / deleted their account, when, from which IP. Without it,
 *   incidents are hard to investigate and "right to access" requests
 *   can't be answered.
 *
 * Design notes:
 *   - Writes are deliberately fire-and-forget — auth flows must not
 *     fail because the audit row couldn't be written. We log the
 *     failure (so it's visible in stdout) but never re-throw.
 *   - IP and user-agent are extracted from the request when one is
 *     available; both are best-effort because behind a load balancer
 *     `req.ip` may be the LB's address. Operators should set
 *     `app.set('trust proxy', true)` (NestJS exposes this via the
 *     underlying Express adapter) to get the real client IP.
 *   - The newValues / oldValues are persisted as Prisma `Json`. Anything
 *     written here goes through pino's redact paths first only when
 *     it's also logged; the DB itself is the canonical store and is
 *     assumed to be PII-safe.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestMeta(event.request);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId ?? null,
          oldValues: (event.oldValues ?? null) as any,
          newValues: (event.newValues ?? null) as any,
          ipAddress,
          userAgent,
        },
      });
    } catch (err: any) {
      // Audit writes are best-effort. Surfacing the error to the caller
      // would break user-facing flows for what is, fundamentally, a
      // bookkeeping concern. The log line is the fallback evidence.
      this.logger.warn('Failed to write audit log', {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        error: err?.message ?? String(err),
      });
    }
  }

  private extractRequestMeta(req?: Request): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    if (!req) return { ipAddress: null, userAgent: null };

    // Prefer the right-most X-Forwarded-For entry (the original client
    // when traversing one or more trusted proxies). Falls back to
    // express's `req.ip` and the raw socket address if neither is set.
    const fwd = req.headers['x-forwarded-for'];
    let ip: string | null = null;
    if (typeof fwd === 'string' && fwd.length > 0) {
      ip = fwd.split(',')[0]?.trim() ?? null;
    } else if (Array.isArray(fwd) && fwd.length > 0) {
      ip = fwd[0] ?? null;
    } else if (req.ip) {
      ip = req.ip;
    } else if (req.socket?.remoteAddress) {
      ip = req.socket.remoteAddress;
    }

    const ua = req.headers['user-agent'];
    return {
      ipAddress: ip,
      userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null,
    };
  }
}
