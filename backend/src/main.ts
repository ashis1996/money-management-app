import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './modules/app.module';
import { Logger } from './common/utils/logger';
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
  // Attach RabbitMQ microservice listener so @MessagePattern handlers
  // (RabbitMQConsumer) actually receive published events. Without this,
  // every publishTransactionCreated / publishSmsReceived was a no-op
  // because there was no consumer subscribed to the queue.
  // ------------------------------------------------------------------
  const rabbitUrl = configService.get<string>(
    'RABBITMQ_URL',
    'amqp://guest:guest@localhost:5672',
  );
  const queue = configService.get<string>('RABBITMQ_SMS_QUEUE', 'sms.processing');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitUrl],
        queue,
        queueOptions: { durable: true },
        // noAck:false (default) so failed handlers can be requeued.
        // prefetchCount keeps the worker from gulping a backlog at once.
        prefetchCount: 10,
      },
    },
    { inheritAppConfig: true },
  );

  try {
    await app.startAllMicroservices();
    logger.log(`RabbitMQ consumer listening on queue '${queue}'`);
  } catch (error: any) {
    // Don't crash the HTTP server if the broker is briefly unavailable.
    logger.warn(
      `Could not start RabbitMQ microservice: ${error?.message ?? error}. ` +
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
  console.error('Failed to start application:', error);
  process.exit(1);
});
