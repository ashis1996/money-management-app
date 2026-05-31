import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@money-management/shared/types';
import { PrismaService } from './prisma.service';
import { requireSecret } from './secret-validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // No fallback. requireSecret() throws if JWT_SECRET is missing or weak.
      secretOrKey: requireSecret(configService, 'JWT_SECRET'),
    });
  }

  /**
   * Validate the JWT payload against persistent server state.
   *
   * Beyond signature and expiry (which Passport already verified), we
   * cross-check the token's `tv` claim with `User.tokenVersion`. If the
   * user has logged out everywhere or rotated credentials since the token
   * was issued, `tokenVersion` will have been bumped and this check
   * rejects the token. Without this, a stolen access token remained valid
   * for its full ~15-minute lifetime even after the user explicitly
   * pressed "log out".
   *
   * Tokens issued before this feature shipped have no `tv` claim; we
   * treat them as version 0, which matches the column default for
   * existing rows. They continue to work until they expire naturally.
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const claimedVersion = payload.tv ?? 0;
    if (claimedVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return { id: user.id, email: user.email };
  }
}
