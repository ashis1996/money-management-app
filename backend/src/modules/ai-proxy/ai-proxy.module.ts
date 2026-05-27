import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiProxyController } from './ai-proxy.controller';
import { AiProxyService } from './ai-proxy.service';
import { TransactionEnrichmentService } from './transaction-enrichment.service';
import { ActionCardModule } from '../action-card/action-card.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 2,
    }),
    ActionCardModule,
  ],
  controllers: [AiProxyController],
  providers: [AiProxyService, TransactionEnrichmentService],
  exports: [AiProxyService, TransactionEnrichmentService],
})
export class AiProxyModule {}
