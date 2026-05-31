import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateUserDto } from '@money-management/shared/dto';
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

  /**
   * Update the caller's profile. Body is a typed UpdateUserDto, so the
   * global ValidationPipe with `whitelist: true` + `forbidNonWhitelisted`
   * rejects unknown keys (e.g. a client trying to PATCH `tokenVersion`
   * or `passwordHash`). Previously this used `@Body() updateData: any`
   * which made every field on the User row reachable by guessing names.
   */
  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@User() user: RequestUser, @Body() updateData: UpdateUserDto) {
    return this.userService.update(user.id, updateData);
  }

  /**
   * GDPR/DPDP "right to access" — return everything we have on the user
   * as a single JSON blob. Intentionally limited to the caller's own
   * record (JwtAuthGuard sets req.user from the access token); there's
   * no parameter to specify another user.
   */
  @Get('me/export')
  @ApiOperation({ summary: 'Export all data for the authenticated user' })
  exportSelf(@User() user: RequestUser, @Req() req: Request) {
    return this.userService.exportSelf(user.id, req);
  }

  /**
   * GDPR/DPDP "right to erasure". Hard-deletes the caller's user row;
   * all FK-cascading data goes with it (see UserService.deleteSelf).
   * Audit row is written before the delete so the tombstone survives.
   *
   * 204 No Content because the response body is empty by design — the
   * resource that would have been the body no longer exists.
   */
  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: "Delete the authenticated user's account and all data" })
  async deleteSelf(@User() user: RequestUser, @Req() req: Request): Promise<void> {
    await this.userService.deleteSelf(user.id, req);
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
      throw new ForbiddenException('You can only retrieve your own user record. Use /users/me.');
    }
    return this.userService.findById(id);
  }
}
