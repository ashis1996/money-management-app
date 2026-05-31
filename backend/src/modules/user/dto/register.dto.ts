import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for POST /auth/register.
 *
 * Validation is enforced by the global ValidationPipe with `whitelist: true`
 * and `forbidNonWhitelisted: true`, so any extra properties are rejected
 * before the controller method runs. This is the layer that prevents
 * NoSQL/operator-injection payloads like `{ email: { $ne: null } }` from
 * reaching Prisma.
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'StrongP@ssw0rd',
    description: 'Password between 8 and 128 characters',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'E.164 phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone must be a valid E.164 number (e.g. +919876543210)',
  })
  phone?: string;
}
