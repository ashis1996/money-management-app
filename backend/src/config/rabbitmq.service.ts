import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Client, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
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
    try {
      await this.client.connect();
      this.logger.log('RabbitMQ connection established');
    } catch (error: any) {
      // Don't crash the app on startup if RabbitMQ is briefly unavailable —
      // the publish methods below already swallow errors so the API stays up.
      this.logger.warn(
        `RabbitMQ connection failed at startup, will retry on first publish: ${error?.message ?? error}`,
      );
    }
  }

  /**
   * Fire-and-forget publish. We use `emit` (event/pub-sub) rather than `send`
   * (request/response) so the publisher does not block waiting for a reply
   * that no consumer would produce.
   *
   * Failures are logged but never thrown — RabbitMQ being temporarily down
   * must not break the user-facing request that triggered the event.
   */
  async publish<T>(pattern: string, message: T): Promise<void> {
    try {
      await firstValueFrom(this.client.emit(pattern, message));
      this.logger.debug(`Message emitted to ${pattern}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to emit message to ${pattern}: ${error?.message ?? error}`,
      );
      // Intentionally swallow — best-effort delivery.
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
