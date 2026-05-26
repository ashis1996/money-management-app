import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { InsightPeriod } from '@money-management/shared/dto';

@ApiTags('insights')
@Controller('insights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get('spending')
  @ApiOperation({ summary: 'Get spending insights' })
  @ApiQuery({ name: 'period', required: false, enum: InsightPeriod })
  getSpending(@User() user: any, @Query('period') period?: InsightPeriod) {
    return this.insightsService.getSpendingInsights(user.id, period || InsightPeriod.MONTH);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get financial recommendations' })
  getRecommendations(@User() user: any) {
    return this.insightsService.getRecommendations(user.id);
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Get spending predictions' })
  getPredictions(@User() user: any) {
    return this.insightsService.getPredictions(user.id);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Get spending anomalies' })
  getAnomalies(@User() user: any) {
    return this.insightsService.getAnomalies(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all insights' })
  getAllInsights(@User() user: any) {
    return this.insightsService.getAllInsights(user.id);
  }
}
