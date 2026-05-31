import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsRetentionCron } from './sms-retention.cron';
import { RabbitMQModule } from '../../config/rabbitmq.module';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [RabbitMQModule, HttpModule, AiProxyModule],
  controllers: [SmsController],
  // SmsRetentionCron is registered here so @nestjs/schedule's discovery
  // wires the daily @Cron handler at boot. The cron has no public
  // surface — operators tune it via SMS_RETENTION_DAYS.
  providers: [SmsService, SmsRetentionCron],
  exports: [SmsService],
})
export class SmsModule {}
