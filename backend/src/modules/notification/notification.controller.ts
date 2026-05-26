import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateNotificationDto, UpdateNotificationPreferencesDto } from '@money-management/shared/dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications' })
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  findAll(@User() user: any, @Query('unread') unread?: string) {
    return this.notificationService.findAll(user.id, unread === 'true');
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@User() user: any) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@User() user: any) {
    return this.notificationService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(@User() user: any, @Body() prefs: UpdateNotificationPreferencesDto) {
    return this.notificationService.updatePreferences(user.id, prefs);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  findOne(@User() user: any, @Param('id') id: string) {
    return this.notificationService.findOne(user.id, id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@User() user: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@User() user: any) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  delete(@User() user: any, @Param('id') id: string) {
    return this.notificationService.delete(user.id, id);
  }

  // Admin/internal endpoint for creating notifications
  @Post()
  @ApiOperation({ summary: 'Create notification (internal use)' })
  create(@User() user: any, @Body() dto: CreateNotificationDto) {
    return this.notificationService.create(user.id, dto);
  }
}
