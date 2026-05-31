import { IsJWT, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /auth/refresh. The token is required and must look like a
 * JWT — strict validation up front avoids touching the database with a
 * malformed/non-string value.
 */
export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token previously issued by /auth/login' })
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken!: string;
}
