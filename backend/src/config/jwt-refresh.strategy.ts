import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '@money-management/shared/types';
import { requireSecret } from './secret-validation';

/**
 * Passport strategy used by `RefreshTokenGuard` to validate the body of
 * `POST /auth/refresh`.
 *
 * Why this exists:
 *   `RefreshTokenGuard` extends `AuthGuard('jwt-refresh')` and was wired
 *   onto the refresh route, but no Passport strategy named `jwt-refresh`
 *   was ever registered. The result was that every refresh call returned
 *   a 401 with "Unknown authentication strategy" before AuthService could
 *   even look up the token in the database — i.e. the entire refresh
 *   path was dead.
 *
 * What it validates:
 *   - The body field `refreshToken` is a JWT signed with
 *     REFRESH_TOKEN_SECRET. Signature + expiry are verified by
 *     passport-jwt; a malformed or expired token short-circuits to 401
 *     here, before the service hits the DB.
 *   - We deliberately do NOT verify the `tv` (tokenVersion) claim here.
 *     That happens in AuthService.refreshTokens, which fetches the row
 *     by tokenHash and compares against the live `User.tokenVersion`.
 *     Doing it twice would duplicate DB work; doing it only here would
 *     skip the hash check entirely.
 *
 * Body extraction:
 *   `passport-jwt` doesn't ship a body extractor, so we provide a small
 *   one. It defends against the request body being missing or being a
 *   non-object (e.g. a raw string) so we never throw inside the
 *   extractor — passport treats a thrown extractor as a server error.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => {
          const body = (req?.body ?? {}) as Record<string, unknown>;
          const token = body['refreshToken'];
          return typeof token === 'string' && token.length > 0 ? token : null;
        },
      ]),
      ignoreExpiration: false,
      // No fallback. requireSecret() throws if REFRESH_TOKEN_SECRET is
      // missing or a known placeholder. Same posture as JwtStrategy.
      secretOrKey: requireSecret(configService, 'REFRESH_TOKEN_SECRET'),
    });
  }

  /**
   * Passport calls validate() with the decoded payload; whatever we
   * return is attached to `req.user`. The downstream controller uses the
   * raw `dto.refreshToken` (not `req.user`) when calling AuthService, so
   * we just return a minimal user shape for completeness.
   */
  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Malformed refresh token');
    }
    return { id: payload.sub, email: payload.email };
  }
}
