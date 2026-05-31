import { Controller, Post, Body, UseGuards, HttpCode, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RefreshTokenGuard } from '../../common/guards/refresh-token.guard';
import { Public } from '../../common/decorators/public.decorator';
import { User, RequestUser } from '../../common/decorators/user.decorator';
import { LoginDto } from '@money-management/shared/dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Public so a future global JwtAuthGuard wouldn't accidentally lock it out.
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  // The Express request is passed to the service so the AuditLog row can
  // capture IP + user-agent. Without it the audit trail loses the
  // investigation-critical "where" dimension.
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto.email, dto.password, dto.name, dto.phone, req);
  }

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Login user' })
  // The body is also documented for Swagger; LocalAuthGuard validates it
  // via passport-local using the email/password fields. The req is
  // passed to record IP / UA in the audit log.
  async login(@User() user: RequestUser, @Body() _dto: LoginDto, @Req() req: Request) {
    return this.authService.generateSession(user as any, req);
  }

  @Public()
  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshTokens(dto.refreshToken, req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@User() user: RequestUser, @Body() dto: LogoutDto, @Req() req: Request) {
    await this.authService.logout(user.id, dto.refreshToken, req);
    return { message: 'Logged out successfully' };
  }
}
