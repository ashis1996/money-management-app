import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../../config/jwt.config';
import { LocalStrategy } from '../../config/local.strategy';
import { requireSecret } from '../../config/secret-validation';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // No fallback. requireSecret() throws if JWT_SECRET is missing/weak,
        // so the module fails to construct rather than booting with a
        // publicly known value.
        secret: requireSecret(configService, 'JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserController, AuthController],
  providers: [UserService, AuthService, JwtStrategy, LocalStrategy],
  exports: [UserService, AuthService],
})
export class UserModule {}
