import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from '@money-management/shared/dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  create(@User() user: RequestUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  findAll(@User() user: RequestUser, @Query('status') status?: string) {
    return this.subscriptionService.findAll(user.id, status);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get subscriptions summary' })
  getSummary(@User() user: RequestUser) {
    return this.subscriptionService.getSummary(user.id);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming payments' })
  getUpcoming(@User() user: RequestUser, @Query('days') days?: string) {
    return this.subscriptionService.getUpcomingPayments(user.id, days ? parseInt(days, 10) : 7);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  findOne(@User() user: RequestUser, @Param('id') id: string) {
    return this.subscriptionService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  update(@User() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  delete(@User() user: RequestUser, @Param('id') id: string) {
    return this.subscriptionService.delete(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(@User() user: RequestUser, @Param('id') id: string) {
    return this.subscriptionService.cancelSubscription(user.id, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause subscription' })
  pause(@User() user: RequestUser, @Param('id') id: string) {
    return this.subscriptionService.pauseSubscription(user.id, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume subscription' })
  resume(@User() user: RequestUser, @Param('id') id: string) {
    return this.subscriptionService.resumeSubscription(user.id, id);
  }

  @Post('detect')
  @ApiOperation({ summary: 'Detect subscriptions from transactions' })
  async detect(@User() user: RequestUser) {
    const detected = await this.subscriptionService.detectSubscriptions(user.id);
    const saved = await this.subscriptionService.saveDetectedSubscriptions(user.id, detected);
    return {
      detected: detected.length,
      saved: saved.length,
      subscriptions: saved,
    };
  }
}
