import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeeklySummaryController } from './weekly-summary.controller';
import { WeeklySummaryService } from './weekly-summary.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [HttpModule, AiProxyModule],
  controllers: [WeeklySummaryController],
  providers: [WeeklySummaryService],
  exports: [WeeklySummaryService],
})
export class WeeklySummaryModule {}
