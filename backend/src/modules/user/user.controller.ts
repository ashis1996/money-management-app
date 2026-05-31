import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@User() user: RequestUser) {
    return this.userService.findById(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@User() user: RequestUser, @Body() updateData: any) {
    return this.userService.update(user.id, updateData);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboard(@User() user: RequestUser) {
    return this.userService.getDashboardStats(user.id);
  }

  /**
   * Lookup by ID is restricted to the caller's own ID. The route is kept
   * for backward compatibility and parity with /users/me, but cross-user
   * access is forbidden — without this check any authenticated user could
   * read any other user's profile.
   *
   * `ParseUUIDPipe` is the second line of defence: it makes the parameter
   * strictly UUID-shaped, which means a future static route like
   * `/users/preferences` or `/users/dashboard` cannot ever be swallowed by
   * this dynamic handler. A non-UUID hits a 400 here instead of accidentally
   * leaking through to `findById('preferences')`.
   */
  @Get(':id')
  @ApiOperation({ summary: "Get user by ID (only the caller's own ID is allowed)" })
  getUserById(
    @User() user: RequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    if (id !== user.id) {
      throw new ForbiddenException(
        'You can only retrieve your own user record. Use /users/me.',
      );
    }
    return this.userService.findById(id);
  }
}
