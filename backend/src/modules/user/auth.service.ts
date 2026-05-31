import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { HashUtils } from '../../common/utils/hash';
import { requireSecret } from '../../config/secret-validation';
import { AuditService } from '../audit/audit.service';
import { LoginDto, AuthResponseDto, UserResponseDto } from '@money-management/shared/dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private audit: AuditService,
  ) {}

  /**
   * Refresh tokens are stored as SHA-256 hashes, never plaintext. Bcrypt is
   * deliberately avoided here because we need an O(1) lookup by hash on the
   * refresh path; the underlying token already has full JWT entropy so a
   * fast keyed digest is sufficient to defend against DB-read attacks.
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async validateUser(email: string, password: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) return null;

    const isPasswordValid = await HashUtils.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) return null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _ph, ...result } = user;
    return result as unknown as UserResponseDto;
  }

  async login(loginDto: LoginDto, request?: Request): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      // Failed login is one of the most useful audit signals — repeated
      // failures from the same IP are how brute-force attempts surface.
      // We deliberately don't include the attempted password (pino redact
      // would catch it anyway, but it's simpler to never write it).
      void this.audit.record({
        userId: null,
        action: 'AUTH_LOGIN_FAILURE',
        entityType: 'User',
        entityId: null,
        newValues: { email: loginDto.email },
        request,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    void this.audit.record({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      request,
    });

    // validateUser returns the row sans passwordHash; tokenVersion is
    // present at runtime even though it isn't declared on UserResponseDto.
    // Pass it through so issueSessionForUserId doesn't have to round-trip
    // to the DB just to read a value we already have.
    return this.issueSessionForUserId(
      user.id,
      user.email,
      user as UserResponseDto,
      (user as any).tokenVersion,
    );
  }

  async register(
    email: string,
    password: string,
    name?: string,
    phone?: string,
    request?: Request,
  ): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new BadRequestException('Email already registered');

    const passwordHash = await HashUtils.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create default account
    await this.prisma.account.create({
      data: {
        userId: user.id,
        accountName: 'Main Account',
        accountType: 'BANK',
        balance: 0,
        isPrimary: true,
      },
    });

    void this.audit.record({
      userId: user.id,
      action: 'AUTH_REGISTER',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, hasPhone: !!user.phone },
      request,
    });

    return this.issueSessionForUserId(
      user.id,
      user.email,
      user as UserResponseDto,
      user.tokenVersion,
    );
  }

  async refreshTokens(refreshToken: string, request?: Request): Promise<AuthResponseDto> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const { passwordHash: _ph, ...userView } = storedToken.user;

    void this.audit.record({
      userId: storedToken.user.id,
      action: 'AUTH_REFRESH',
      entityType: 'RefreshToken',
      entityId: storedToken.id,
      request,
    });

    return this.issueSessionForUserId(
      storedToken.user.id,
      storedToken.user.email,
      userView as unknown as UserResponseDto,
      storedToken.user.tokenVersion,
    );
  }

  /**
   * Logout.
   *
   * Two modes:
   *
   *   - logout(userId, refreshToken): single-device logout. Only the
   *     specific refresh token is revoked. The access token issued
   *     alongside it remains valid for the rest of its ~15-min lifetime.
   *     This matches the typical mobile "Sign out" expectation: the
   *     device's session ends, other devices keep working.
   *
   *   - logout(userId): logout-everywhere. We bump `User.tokenVersion`,
   *     which immediately invalidates *every* outstanding access token
   *     for this user (JwtStrategy will reject them on the next request).
   *     We also delete every refresh token. This is the "Sign out of all
   *     devices" / "Reset password" path.
   */
  async logout(userId: string, refreshToken?: string, request?: Request): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashRefreshToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
      void this.audit.record({
        userId,
        action: 'AUTH_LOGOUT',
        entityType: 'RefreshToken',
        request,
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    void this.audit.record({
      userId,
      action: 'AUTH_LOGOUT_ALL',
      entityType: 'User',
      entityId: userId,
      request,
    });
  }

  /**
   * Convenience used by the LocalAuthGuard login flow where the user has
   * already been validated and we just need a session.
   */
  async generateSession(user: UserResponseDto, request?: Request): Promise<AuthResponseDto> {
    void this.audit.record({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      request,
    });
    return this.issueSessionForUserId(user.id, user.email, user, (user as any).tokenVersion);
  }

  /**
   * Single internal entry point that issues a fresh access+refresh token
   * pair. Reads the user's current tokenVersion (or accepts it from the
   * caller to save a roundtrip) and embeds it in the access token's `tv`
   * claim so JwtStrategy can reject revoked tokens.
   */
  private async issueSessionForUserId(
    userId: string,
    email: string,
    user: UserResponseDto,
    knownTokenVersion?: number,
  ): Promise<AuthResponseDto> {
    const tokenVersion: number =
      knownTokenVersion ??
      (await this.prisma.user
        .findFirst({ where: { id: userId }, select: { tokenVersion: true } })
        .then((u) => u?.tokenVersion ?? 0));

    const tokens = await this.generateTokens(userId, email, tokenVersion);
    await this.saveRefreshToken(userId, tokens.refreshToken);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN', '15m')),
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, email, tv: tokenVersion }),
      this.jwtService.signAsync(
        { sub: userId, email, tv: tokenVersion, type: 'refresh' },
        {
          // No fallback. requireSecret() throws if REFRESH_TOKEN_SECRET is
          // missing or a known placeholder, ensuring we never sign refresh
          // tokens with a publicly known string.
          secret: requireSecret(this.configService, 'REFRESH_TOKEN_SECRET'),
          expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashRefreshToken(token), expiresAt },
    });
  }
}
