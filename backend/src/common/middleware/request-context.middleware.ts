import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext, newRequestId, requestContextStore } from '../utils/pino-logger';

/**
 * Sets up the per-request AsyncLocalStorage context so every log line
 * emitted while this request is in flight carries the same `reqId`,
 * regardless of how deep the call stack goes (controller → service →
 * Prisma → external HTTP).
 *
 * - If the caller sent `X-Request-Id`, we honor it (lets the mobile
 *   app or an upstream proxy pass through their own correlation id).
 * - Otherwise we generate a UUID v4.
 * - We always mirror the chosen id back to the response as
 *   `X-Request-Id` so the client / load balancer can correlate.
 *
 * Mounted globally in app.module.ts so it runs ahead of every route,
 * including the routes that have their own ValidationPipe rejection
 * paths (4xx errors get a reqId too).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const reqId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200
        ? incoming
        : newRequestId();

    res.setHeader('X-Request-Id', reqId);

    const context: RequestContext = { reqId };
    requestContextStore.run(context, () => next());
  }
}
