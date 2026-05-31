import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionScanCron } from './subscription-scan.cron';
import { RabbitMQModule } from '../../config/rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  controllers: [SubscriptionController],
  // SubscriptionScanCron runs the weekly long-tail detection that the
  // per-transaction consumer can't see (see the file's comment). It's
  // declared here so it's wired automatically when SubscriptionModule
  // boots; @nestjs/schedule's discovery picks up the @Cron decorator.
  providers: [SubscriptionService, SubscriptionScanCron],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
