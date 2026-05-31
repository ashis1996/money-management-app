import { Injectable } from '@nestjs/common';
import { rootLogger } from './pino-logger';

/**
 * Backwards-compatible Logger.
 *
 * The class signature (`new Logger(context)` + log/debug/warn/error/verbose)
 * is preserved so the ~14 call sites across the backend keep working
 * without churn. Internally it's now a thin wrapper over a pino child
 * logger:
 *
 *   - JSON output in production, pretty-printed in dev.
 *   - PII redaction (see PII_REDACT_PATHS in pino-logger.ts).
 *   - Per-request correlation id (`reqId`) injected via
 *     AsyncLocalStorage by RequestContextMiddleware — service-level
 *     logs are now traceable back to the originating HTTP request
 *     without callers passing the id through manually.
 *
 * Migration note: pino's redact only operates on structured fields,
 * not values interpolated into the message string. Prefer
 *   logger.log('event', { merchantName })
 * over
 *   logger.log(`bought from ${merchantName}`)
 * when logging anything that could carry PII.
 */
@Injectable()
export class Logger {
  private readonly context: string;
  private readonly child: ReturnType<typeof rootLogger.child>;

  constructor(context?: string) {
    this.context = context || 'App';
    this.child = rootLogger.child({ context: this.context });
  }

  /**
   * Map the legacy `log` (info-level) onto pino's `info`. The optional
   * second argument is treated as a structured payload that pino can
   * redact field-by-field, which is the recommended way to log PII-
   * sensitive context.
   */
  log(message: string, payload?: Record<string, unknown>): void {
    if (payload) this.child.info(payload, message);
    else this.child.info(message);
  }

  debug(message: string, payload?: Record<string, unknown>): void {
    if (payload) this.child.debug(payload, message);
    else this.child.debug(message);
  }

  warn(message: string, payload?: Record<string, unknown>): void {
    if (payload) this.child.warn(payload, message);
    else this.child.warn(message);
  }

  /**
   * `trace` here is the legacy second-arg name (a stack trace string),
   * not pino's `trace` log level. We log it as a structured field so
   * aggregators can filter on it.
   */
  error(message: string, trace?: string, payload?: Record<string, unknown>): void {
    const merged: Record<string, unknown> = { ...(payload ?? {}) };
    if (trace) merged.stack = trace;
    if (Object.keys(merged).length > 0) this.child.error(merged, message);
    else this.child.error(message);
  }

  verbose(message: string, payload?: Record<string, unknown>): void {
    // pino has no `verbose` level; map onto `trace` which is more verbose
    // than `debug`. Existing call sites expecting `verbose` only fire when
    // LOG_LEVEL is set to `trace` (more permissive than the previous
    // `debug` gate, but consistent with pino's level hierarchy).
    if (payload) this.child.trace(payload, message);
    else this.child.trace(message);
  }
}
