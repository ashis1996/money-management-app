import { IsString, IsEmail, IsOptional, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * Body shape for `PUT /users/me`.
 *
 * The previous controller signature was `@Body() updateData: any`, which
 * meant the global ValidationPipe (whitelist + forbidNonWhitelisted)
 * accepted whatever the client sent. Locking this down stops a caller
 * from quietly overwriting privileged fields like `tokenVersion`,
 * `passwordHash`, `archetype`, or any future column we add.
 *
 * Every field is optional — a partial update sends only the changed
 * keys. Validation rules mirror the equivalent fields on RegisterDto
 * so name/phone constraints stay consistent across endpoints.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone must be a valid E.164 number (e.g. +919876543210)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class UserResponseDto {
  id!: string;
  email!: string;
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  createdAt!: Date;
  updatedAt?: Date;
}

export class AuthResponseDto {
  user!: UserResponseDto;
  accessToken!: string;
  refreshToken!: string;
  expiresIn?: number;
}
