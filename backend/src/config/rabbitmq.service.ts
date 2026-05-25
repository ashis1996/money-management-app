import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Client, ClientProxy } from '@nestjs/microservices';
import { Logger } from '../common/utils/logger';

export interface RabbitMQMessage<T> {
  type: string;
  data: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);

  @Inject('RABBITMQ')
  private client: ClientProxy;

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('RabbitMQ connection established');
  }

  async publish<T>(pattern: string, message: T): Promise<void> {
    try {
      await this.client.send(pattern, message).toPromise();
      this.logger.debug(`Message published to ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to ${pattern}:`, error);
      throw error;
    }
  }

  async publishSmsReceived(data: { smsId: string; body: string; sender: string; timestamp: Date }): Promise<void> {
    return this.publish('sms.received', {
      type: 'SMS_RECEIVED',
      data,
      timestamp: new Date(),
    });
  }

  async publishTransactionCreated(data: { transactionId: string; userId: string; amount: number; category: string }): Promise<void> {
    return this.publish('transaction.created', {
      type: 'TRANSACTION_CREATED',
      data,
      timestamp: new Date(),
    });
  }

  async publishSubscriptionDetected(data: { subscriptionId: string; userId: string; merchant: string; amount: number }): Promise<void> {
    return this.publish('subscription.detected', {
      type: 'SUBSCRIPTION_DETECTED',
      data,
      timestamp: new Date(),
    });
  }

  async publishNotificationRequest(data: { userId: string; type: string; title: string; body: string }): Promise<void> {
    return this.publish('notifications', {
      type: 'NOTIFICATION_REQUEST',
      data,
      timestamp: new Date(),
    });
  }
}
