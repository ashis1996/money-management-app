import { Module } from '@nestjs/common';
import { RabbitMQConsumer } from './rabbitmq.consumer';
import { SubscriptionModule } from '../../modules/subscription/subscription.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { AiProxyModule } from '../../modules/ai-proxy/ai-proxy.module';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [
    // SmsModule no longer needed: handleSmsReceived was deleted to remove
    // the duplicate transaction-creation path.
    SubscriptionModule,
    NotificationModule,
    AiProxyModule,
    PrismaModule,
  ],
  controllers: [RabbitMQConsumer],
  providers: [],
})
export class ConsumersModule {}
