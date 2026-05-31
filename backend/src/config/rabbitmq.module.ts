import { Module, Global, DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';

/**
 * DI tokens for the per-event-type RabbitMQ client proxies.
 *
 * Previously every event went through one shared queue (`sms.processing`),
 * which meant a slow handler — say a stuck AI fan-out for
 * `transaction.created` — blocked unrelated handlers like `notifications`
 * because they competed for the same prefetch slots. Splitting into one
 * queue per event type lets each consumer scale, retry, and DLQ
 * independently.
 *
 * Publishers inject the matching token (see RabbitMQService) so the
 * routing decision is made at compile time, not by the broker.
 */
export const RABBITMQ_TRANSACTION_CLIENT = 'RABBITMQ_TRANSACTION_CLIENT';
export const RABBITMQ_SUBSCRIPTION_CLIENT = 'RABBITMQ_SUBSCRIPTION_CLIENT';
export const RABBITMQ_NOTIFICATION_CLIENT = 'RABBITMQ_NOTIFICATION_CLIENT';

/**
 * Default queue names if env is unset. We keep the old `sms.processing`
 * name OUT of this file — it referred to a now-deleted handler and
 * shouldn't be reused for the new design.
 */
export const DEFAULT_TRANSACTION_QUEUE = 'transaction.events';
export const DEFAULT_SUBSCRIPTION_QUEUE = 'subscription.events';
export const DEFAULT_NOTIFICATION_QUEUE = 'notification.events';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_TRANSACTION_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: config.get<string>('RABBITMQ_TRANSACTION_QUEUE', DEFAULT_TRANSACTION_QUEUE),
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: RABBITMQ_SUBSCRIPTION_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: config.get<string>('RABBITMQ_SUBSCRIPTION_QUEUE', DEFAULT_SUBSCRIPTION_QUEUE),
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: RABBITMQ_NOTIFICATION_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: config.get<string>('RABBITMQ_NOTIFICATION_QUEUE', DEFAULT_NOTIFICATION_QUEUE),
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {
  static forRoot(): DynamicModule {
    return {
      module: RabbitMQModule,
      global: true,
    };
  }
}
