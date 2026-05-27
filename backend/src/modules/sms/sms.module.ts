import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { RabbitMQModule } from '../../config/rabbitmq.module';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [RabbitMQModule, HttpModule, AiProxyModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
