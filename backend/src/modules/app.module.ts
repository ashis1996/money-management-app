import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { SmsModule } from './sms/sms.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { InsightsModule } from './insights/insights.module';
import { NotificationModule } from './notification/notification.module';
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

    // Caching
    CacheModule.register({
      isGlobal: true,
      ttl: 300,
      max: 1000,
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

    // Event Consumers
    ConsumersModule,
  ],
})
export class AppModule {}
