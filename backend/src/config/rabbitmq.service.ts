import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Logger } from '../common/utils/logger';
import {
  RABBITMQ_TRANSACTION_CLIENT,
  RABBITMQ_SUBSCRIPTION_CLIENT,
  RABBITMQ_NOTIFICATION_CLIENT,
} from './rabbitmq.module';

export interface RabbitMQMessage<T> {
  type: string;
  data: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Publisher for domain events. Each event type lives on its own queue so a
 * slow handler can't block unrelated work — see rabbitmq.module.ts for the
 * rationale and queue naming.
 *
 * Failures are logged but never thrown: RabbitMQ being briefly unavailable
 * must not break the user-facing request that triggered the event. The
 * underlying `transaction.created` is already persisted by the time we
 * publish, so dropping the event is recoverable (worst case: notifications
 * lag until the broker is back).
 */
@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(
    @Inject(RABBITMQ_TRANSACTION_CLIENT) private readonly txClient: ClientProxy,
    @Inject(RABBITMQ_SUBSCRIPTION_CLIENT) private readonly subClient: ClientProxy,
    @Inject(RABBITMQ_NOTIFICATION_CLIENT) private readonly notifClient: ClientProxy,
  ) {}

  async onModuleInit() {
    // Fire connect attempts in parallel; warn on each failure individually
    // so an outage on one queue doesn't mask the status of the others.
    await Promise.all(
      [
        ['transaction', this.txClient],
        ['subscription', this.subClient],
        ['notification', this.notifClient],
      ].map(async ([name, client]) => {
        try {
          await (client as ClientProxy).connect();
          this.logger.log(`RabbitMQ ${name} client connected`);
        } catch (error: any) {
          this.logger.warn(
            `RabbitMQ ${name} client failed to connect at startup, will retry on first publish: ` +
              `${error?.message ?? error}`,
          );
        }
      }),
    );
  }

  /**
   * Generic emit helper. Used by the typed `publish*` methods below to keep
   * error handling uniform.
   */
  private async emit<T>(
    client: ClientProxy,
    pattern: string,
    payload: RabbitMQMessage<T>,
  ): Promise<void> {
    try {
      await firstValueFrom(client.emit(pattern, payload));
      this.logger.debug(`Message emitted to ${pattern}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to emit message to ${pattern}: ${error?.message ?? error}`,
      );
      // Intentionally swallow — best-effort delivery.
    }
  }

  // -------------------------------------------------------------------
  // SMS_RECEIVED is intentionally NOT published any more. The synchronous
  // path in SmsService.ingestSms is the single source of truth for
  // "SMS → Transaction"; the duplicate consumer that used to listen for
  // sms.received was deleted in the high-severity batch. The method below
  // is preserved as a no-op so older deployments / external callers don't
  // break, but it does nothing — and importantly, no consumer subscribes
  // to a queue that would only fill up.
  // -------------------------------------------------------------------
  async publishSmsReceived(_data: {
    smsId: string;
    body: string;
    sender: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.debug(
      'publishSmsReceived is a no-op since the duplicate consumer was removed. ' +
        'Use publishTransactionCreated instead.',
    );
  }

  async publishTransactionCreated(data: {
    transactionId: string;
    userId: string;
    amount: number;
    category: string;
  }): Promise<void> {
    return this.emit(this.txClient, 'transaction.created', {
      type: 'TRANSACTION_CREATED',
      data,
      timestamp: new Date(),
    });
  }

  async publishSubscriptionDetected(data: {
    subscriptionId: string;
    userId: string;
    merchant: string;
    amount: number;
  }): Promise<void> {
    return this.emit(this.subClient, 'subscription.detected', {
      type: 'SUBSCRIPTION_DETECTED',
      data,
      timestamp: new Date(),
    });
  }

  async publishNotificationRequest(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
  }): Promise<void> {
    return this.emit(this.notifClient, 'notifications', {
      type: 'NOTIFICATION_REQUEST',
      data,
      timestamp: new Date(),
    });
  }
}
