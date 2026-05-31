import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';
import { RegisterPushTokenDto, TestPushDto } from './dto/push.dto';

@ApiTags('push')
@Controller('push')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a device push token for the current user' })
  register(@User() user: RequestUser, @Body() dto: RegisterPushTokenDto) {
    return this.pushService.registerToken(user.id, dto);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'List active device tokens for the current user' })
  list(@User() user: RequestUser) {
    return this.pushService.listUserTokens(user.id);
  }

  @Delete('tokens/:token')
  @ApiOperation({ summary: 'Unregister a device token' })
  unregister(@User() user: RequestUser, @Param('token') token: string) {
    return this.pushService.unregisterToken(user.id, token);
  }

  @Post('test')
  @ApiOperation({ summary: 'Send a test push notification to the current user' })
  test(@User() user: RequestUser, @Body() dto: TestPushDto) {
    return this.pushService.testPush(user.id, dto.title, dto.body);
  }
}
