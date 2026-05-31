import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

/**
 * Per-request context. Populated by the request-id middleware in main.ts
 * before any handler runs, then read by Logger so service-level log
 * lines automatically carry the correlation id without every caller
 * having to pass it through.
 *
 * AsyncLocalStorage is the standard Node primitive for "ambient
 * request context"; it's safe across async/await boundaries because
 * V8 maintains the store on the active continuation. The store is
 * populated only inside HTTP handlers — calls outside a request (cron
 * jobs, RabbitMQ consumers, bootstrap) simply log without a reqId.
 */
export interface RequestContext {
  reqId: string;
  userId?: string;
}

export const requestContextStore = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a fresh request id. Used by the middleware when the caller
 * didn't send `X-Request-Id`. The format intentionally matches the
 * standard UUIDv4 so it's compatible with the same downstream tooling
 * (OpenTelemetry, log aggregators) regardless of provenance.
 */
export const newRequestId = (): string => randomUUID();

/**
 * Fields whose values must never appear in stdout in plaintext.
 *
 * Pino's redact paths use a dotted-glob syntax. We list both top-level
 * keys (e.g. `password` for unstructured logs) AND HTTP-shape paths
 * (e.g. `req.body.password` for pino-http's automatic request logging).
 * Order doesn't matter; pino dedupes internally.
 *
 * NOTE: pino's redact only operates on structured fields. An
 * interpolated string like `logger.log(`OTP=${otp}`)` will NOT be
 * redacted automatically. Service code should prefer
 * `logger.log('event', { otp })` over interpolation, OR avoid logging
 * sensitive values at all. The audit-log table is the canonical place
 * for things that must be retained.
 */
const PII_REDACT_PATHS = [
  // Auth / credentials
  'password',
  'passwordHash',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'token',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',

  // Headers carrying secrets
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-token"]',
  'res.headers["set-cookie"]',

  // PII in request bodies
  'req.body.password',
  'req.body.newPassword',
  'req.body.oldPassword',
  'req.body.currentPassword',
  'req.body.refreshToken',
  'req.body.token',
  'req.body.body', // SMS ingest body — full SMS text can contain card last-4 etc.
  'req.body.parsedData',

  // Domain PII
  'accountNumber',
  'maskedAccountNumber',
  'cardNumber',
  'cvv',
  'pan',
  'aadhaar',
  'aadhar',
  'pin',

  // Outbound API keys (in case we ever log a config object)
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'INTERNAL_API_TOKEN',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
];

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: PII_REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  // The `pid` and `hostname` defaults inflate every line and aren't
  // useful in a containerized world where the orchestrator already
  // attaches them. Drop them.
  base: { service: 'backend' },
  // ISO timestamps so log aggregators don't have to parse epoch ms.
  timestamp: pino.stdTimeFunctions.isoTime,
  // Mixin runs on every log call. We use it to surface the active
  // request id from AsyncLocalStorage so service code at any depth
  // can be correlated to the originating HTTP request.
  mixin() {
    const ctx = requestContextStore.getStore();
    if (!ctx) return {};
    return { reqId: ctx.reqId, userId: ctx.userId };
  },
};

/**
 * Pretty-print transport for local development. The transport runs in a
 * worker thread (pino's recommended pattern) so dev's stdout stays
 * human-readable while production keeps single-line JSON for
 * machine parsing.
 *
 * Gated on NODE_ENV !== 'production' (and !== 'test') so a misconfigured
 * prod doesn't accidentally lose JSON structure to pretty output, and
 * unit tests don't spawn a worker thread that lingers between specs.
 */
const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
const isTest = (process.env.NODE_ENV ?? '') === 'test';

const transport =
  isProd || isTest
    ? undefined
    : pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service',
          messageFormat: '[{context}] {msg}',
        },
      });

/**
 * The single root pino instance. Every Logger created via the wrapper
 * below is a child of this so transport, redaction, and base config
 * stay in one place.
 */
export const rootLogger: PinoLogger = pino(baseOptions, transport);
