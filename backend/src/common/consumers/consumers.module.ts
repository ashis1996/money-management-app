import { Module } from '@nestjs/common';
import { RabbitMQConsumer } from './rabbitmq.consumer';
import { SmsModule } from '../../modules/sms/sms.module';
import { SubscriptionModule } from '../../modules/subscription/subscription.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [SmsModule, SubscriptionModule, NotificationModule, PrismaModule],
  providers: [RabbitMQConsumer],
})
export class ConsumersModule {}
