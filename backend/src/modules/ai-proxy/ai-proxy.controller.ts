import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsInt } from 'class-validator';
import { AiProxyService } from './ai-proxy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';

class AskDto {
  @IsString()
  @MinLength(1)
  query!: string;
}

class ParseSmsDto {
  @IsString()
  body!: string;

  @IsString()
  sender!: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiProxyController {
  constructor(private aiProxy: AiProxyService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get personalized dashboard' })
  dashboard(@User() user: RequestUser) {
    return this.aiProxy.getDashboard(user.id);
  }

  @Get('health-score')
  @ApiOperation({ summary: 'Calculate financial health score' })
  healthScore(@User() user: RequestUser) {
    return this.aiProxy.getHealthScore(user.id);
  }

  @Get('leaks')
  @ApiOperation({ summary: 'Detect money leaks' })
  leaks(@User() user: RequestUser) {
    return this.aiProxy.getLeaks(user.id);
  }

  @Get('behavior')
  @ApiOperation({ summary: 'Analyze spending behavior' })
  behavior(@User() user: RequestUser, @Query('days') days?: string) {
    return this.aiProxy.analyzeBehavior(user.id, days ? parseInt(days, 10) : 30);
  }

  @Get('archetype')
  @ApiOperation({ summary: 'Determine user financial archetype' })
  archetype(@User() user: RequestUser) {
    return this.aiProxy.getArchetype(user.id);
  }

  @Post('action-cards/generate')
  @ApiOperation({ summary: 'Generate fresh action cards from AI' })
  generateActionCards(@User() user: RequestUser) {
    return this.aiProxy.generateActionCards(user.id);
  }

  @Post('ask')
  @ApiOperation({ summary: 'Natural language financial query' })
  ask(@User() user: RequestUser, @Body() dto: AskDto) {
    return this.aiProxy.ask(user.id, dto.query);
  }

  @Post('sms/parse')
  @ApiOperation({ summary: 'Parse a single SMS' })
  parseSms(@Body() dto: ParseSmsDto) {
    return this.aiProxy.parseSms(dto.body, dto.sender, dto.timestamp);
  }

  @Post('subscriptions/detect')
  @ApiOperation({ summary: 'Run subscription detection on transaction history' })
  detectSubscriptions(@User() user: RequestUser) {
    return this.aiProxy.detectSubscriptions(user.id);
  }
}
