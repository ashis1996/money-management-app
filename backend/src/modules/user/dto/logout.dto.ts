import { IsJWT, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for POST /auth/logout. The refresh token is optional — when omitted
 * we revoke every refresh token for the user (sign-out-everywhere). When
 * provided it must be a well-formed JWT.
 */
export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token to revoke. When omitted, all refresh tokens for the user are revoked.',
  })
  @IsOptional()
  @IsString()
  @IsJWT()
  refreshToken?: string;
}
