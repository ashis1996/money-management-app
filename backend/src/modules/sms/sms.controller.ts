import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { SmsIngestDto } from '@shared/dto';

@ApiTags('sms')
@Controller('sms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmsController {
  constructor(private smsService: SmsService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest SMS for transaction extraction' })
  ingestSms(@User() user: any, @Body() dto: SmsIngestDto) {
    return this.smsService.ingestSms(user.id, dto);
  }

  @Post('ingest/batch')
  @ApiOperation({ summary: 'Ingest multiple SMS messages' })
  async ingestBatch(@User() user: any, @Body() body: { messages: SmsIngestDto[] }) {
    const results = await Promise.all(
      body.messages.map((msg) => this.smsService.ingestSms(user.id, msg)),
    );

    return {
      success: true,
      total: results.length,
      processed: results.filter((r) => r.success).length,
      transactionsCreated: results.filter((r) => r.transactionCreated).length,
      results,
    };
  }

  @Get('unprocessed')
  @ApiOperation({ summary: 'Get unprocessed SMS messages' })
  getUnprocessed(@User() user: any, @Query('limit') limit?: string) {
    return this.smsService.getUnprocessedSms(user.id, limit ? parseInt(limit, 10) : 100);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get SMS history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(@User() user: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.smsService.getSmsHistory(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('reprocess/:id')
  @ApiOperation({ summary: 'Reprocess an SMS message' })
  async reprocess(@User() user: any, @Param('id') id: string) {
    const smsLog = await this.smsService.getSmsHistory(user.id, 1, 1000).then((r) =>
      r.data.find((s) => s.id === id),
    );

    if (!smsLog) {
      return { success: false, message: 'SMS not found' };
    }

    const parsed = await this.smsService.parseSms(smsLog.body, smsLog.sender, smsLog.receivedAt);

    return {
      success: true,
      parsed,
    };
  }
}
