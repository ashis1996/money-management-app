import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { RabbitMQModule } from '../../config/rabbitmq.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [RabbitMQModule, HttpModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
