import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-store';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { SmsModule } from './sms/sms.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { InsightsModule } from './insights/insights.module';
import { NotificationModule } from './notification/notification.module';
import { GoalModule } from './goal/goal.module';
import { BudgetModule } from './budget/budget.module';
import { AccountModule } from './account/account.module';
import { ActionCardModule } from './action-card/action-card.module';
import { WeeklySummaryModule } from './weekly-summary/weekly-summary.module';
import { AiProxyModule } from './ai-proxy/ai-proxy.module';
import { PushModule } from './push/push.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../config/prisma.module';
import { RabbitMQModule } from '../config/rabbitmq.module';
import { ConsumersModule } from '../common/consumers/consumers.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Cron jobs (e.g. weekly subscription scan in SubscriptionScanCron).
    // forRoot() registers the discovery service that finds @Cron handlers.
    ScheduleModule.forRoot(),

    // -----------------------------------------------------------------
    // Caching.
    //
    // We use Redis when REDIS_HOST is configured so locks (e.g. the
    // TransactionEnrichmentService cooldown) are cluster-wide. With the
    // legacy in-memory store, every backend pod ran AI fan-outs
    // independently — three replicas meant three calls per user. Falling
    // back to in-memory keeps `npm test` and local dev simple.
    // -----------------------------------------------------------------
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<any> => {
        const host = config.get<string>('REDIS_HOST');
        if (!host) {
          return { ttl: 300, max: 1000 };
        }

        // cache-manager-redis-store@3 is structurally compatible with
        // cache-manager v5 at runtime, but its store interface is wider
        // than @nestjs/cache-manager's narrow CacheStore type. Returning
        // `Promise<any>` keeps the bridge typed loosely on this single
        // line without disabling type-checking elsewhere.
        const store = await redisStore({
          socket: {
            host,
            port: parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
          },
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          // cache-manager v5 ttl is in milliseconds for the store option.
          ttl: 300_000,
        });
        return { store };
      },
    }),

    // Infrastructure
    PrismaModule,
    RabbitMQModule,

    // Feature Modules
    UserModule,
    TransactionModule,
    SmsModule,
    SubscriptionModule,
    InsightsModule,
    NotificationModule,
    GoalModule,
    BudgetModule,
    AccountModule,
    ActionCardModule,
    AiProxyModule,
    WeeklySummaryModule,
    PushModule,
    HealthModule,

    // Event Consumers
    ConsumersModule,
  ],
})
export class AppModule {}
