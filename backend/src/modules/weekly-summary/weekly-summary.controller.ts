import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WeeklySummaryService } from './weekly-summary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';

@ApiTags('weekly-summary')
@Controller('weekly-summary')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WeeklySummaryController {
  constructor(private summaryService: WeeklySummaryService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the most recent weekly summary, generating it if missing' })
  getCurrent(@User() user: RequestUser) {
    return this.summaryService.getOrGenerateCurrent(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'List past weekly summaries' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(@User() user: RequestUser, @Query('limit') limit?: string) {
    return this.summaryService.getHistory(user.id, limit ? parseInt(limit, 10) : 12);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific weekly summary' })
  findOne(@User() user: RequestUser, @Param('id') id: string) {
    return this.summaryService.findOne(user.id, id);
  }

  @Post('generate')
  @ApiOperation({ summary: "Force-regenerate this week's summary" })
  generate(@User() user: RequestUser) {
    return this.summaryService.generate(user.id);
  }
}
