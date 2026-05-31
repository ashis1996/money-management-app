import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { AppModule } from './modules/app.module';
import { Logger } from './common/utils/logger';
import { rootLogger } from './common/utils/pino-logger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateRequiredSecrets } from './config/secret-validation';

/**
 * Default CORS allowlist used in non-production environments when
 * ALLOWED_ORIGINS is not set. These cover the local web dev server and
 * the Expo Metro bundler. In production we refuse to default — operators
 * must set ALLOWED_ORIGINS explicitly or the app will boot with CORS
 * disabled (origin: false) which blocks every cross-origin request.
 */
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
];

function resolveCorsOrigins(env: string): string[] | false {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw && raw.length > 0) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  if (env === 'production') {
    // Fail closed in production. Combining `origin: '*'` with
    // `credentials: true` is rejected by browsers anyway and hides
    // misconfiguration; we'd rather block requests than pretend to allow
    // them.
    return false;
  }

  return DEV_DEFAULT_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Fail fast on missing or weak secrets *before* binding the HTTP server.
  // This is a redundant check on top of requireSecret() in jwt.config.ts /
  // user.module.ts / auth.service.ts, but it gives operators a single
  // unified error message at startup.
  validateRequiredSecrets(configService);

  // -----------------------------------------------------------------
  // Request-scoped HTTP logging.
  //
  // pino-http logs one structured line per request with method, path,
  // status, latency, and the same `reqId` that RequestContextMiddleware
  // attaches to AsyncLocalStorage. Health probes are dropped to noise-
  // level so a 5s-interval K8s liveness probe doesn't drown the log.
  //
  // Mounted before helmet so even helmet's own response (e.g. when it
  // rejects a malformed origin) gets a request line and a reqId
  // returned to the caller.
  // -----------------------------------------------------------------
  app.use(
    pinoHttp({
      logger: rootLogger,
      // pino-http already writes its own `reqId`. We pull it from the
      // header set by RequestContextMiddleware (or generate a new one
      // if the middleware hasn't run yet, which happens for routes
      // outside the global prefix).
      genReqId: (req, res) => {
        const fromHeader = req.headers['x-request-id'];
        if (typeof fromHeader === 'string' && fromHeader.length > 0) {
          res.setHeader('X-Request-Id', fromHeader);
          return fromHeader;
        }
        // Fall back to whatever pino-http generated; let the middleware
        // win for in-prefix routes.
        return (req as any).id;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        // Health probes pollute the log when they fire every few seconds.
        if ((_req as any).url?.endsWith('/health')) return 'debug';
        return 'info';
      },
      // Trim default fields we don't need; reqId + method + url + status
      // is enough for correlation, and the redact paths in
      // pino-logger.ts strip authorization etc. from anything that
      // does land.
      serializers: {
        req(req: any) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
        res(res: any) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // Security
  app.use(helmet());

  const env = configService.get<string>('NODE_ENV', 'development');
  const origins = resolveCorsOrigins(env);
  if (origins === false) {
    logger.warn(
      'CORS is disabled: set ALLOWED_ORIGINS=https://your.domain to enable cross-origin requests.',
    );
  } else {
    logger.log(`CORS enabled for origins: ${origins.join(', ')}`);
  }
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Global prefix - single v1 since URI versioning is disabled
  app.setGlobalPrefix('api/v1');

  // (Versioning intentionally disabled to keep paths flat at /api/v1/...
  //  Re-enable if/when v2 is needed.)

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Wrap all responses in { success, data, message } envelope
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Money Management API')
    .setDescription('AI-powered Money Management Mobile Application API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('transactions', 'Transaction CRUD and analysis')
    .addTag('sms', 'SMS ingestion and parsing')
    .addTag('subscriptions', 'Subscription detection and management')
    .addTag('insights', 'AI-powered financial insights')
    .addTag('notifications', 'Notification management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // ------------------------------------------------------------------
  // Attach one RabbitMQ microservice per event-type queue. Each queue's
  // consumer runs independently so a slow handler can't starve unrelated
  // ones, and prefetch can be tuned per workload.
  //
  // Heavy work (transaction.created → AI fan-out) gets a low prefetch so
  // it can't gulp a backlog and lock up the worker; light work
  // (notifications, subscription.detected) gets a higher prefetch.
  // ------------------------------------------------------------------
  const rabbitUrl = configService.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');

  const queues: Array<{ env: string; fallback: string; prefetch: number; label: string }> = [
    {
      env: 'RABBITMQ_TRANSACTION_QUEUE',
      fallback: 'transaction.events',
      prefetch: 5,
      label: 'transaction',
    },
    {
      env: 'RABBITMQ_SUBSCRIPTION_QUEUE',
      fallback: 'subscription.events',
      prefetch: 20,
      label: 'subscription',
    },
    {
      env: 'RABBITMQ_NOTIFICATION_QUEUE',
      fallback: 'notification.events',
      prefetch: 50,
      label: 'notification',
    },
  ];

  const startedQueues: string[] = [];
  for (const q of queues) {
    const queue = configService.get<string>(q.env, q.fallback);
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.RMQ,
        options: {
          urls: [rabbitUrl],
          queue,
          queueOptions: { durable: true },
          // noAck:false (default) so failed handlers can be requeued.
          prefetchCount: q.prefetch,
        },
      },
      { inheritAppConfig: true },
    );
    startedQueues.push(`${q.label}=${queue}`);
  }

  try {
    await app.startAllMicroservices();
    logger.log(`RabbitMQ consumers listening on queues: ${startedQueues.join(', ')}`);
  } catch (error: any) {
    // Don't crash the HTTP server if the broker is briefly unavailable.
    logger.warn(
      `Could not start RabbitMQ microservices: ${error?.message ?? error}. ` +
        `HTTP API will still serve, but async event handlers are disabled until the broker is reachable.`,
    );
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  logger.log(`Health check at http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((error) => {
  // No `console.error` here — bootstrap failure is the one place where
  // the structured logger may not be fully wired, but pino-logger.ts
  // exports the root pino instance which is initialized at module load.
  rootLogger.fatal({ err: error }, 'Failed to start application');
  process.exit(1);
});
