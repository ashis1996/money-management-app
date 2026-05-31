import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../config/prisma.service';
import { HashUtils } from '../../common/utils/hash';

jest.mock('../../common/utils/hash');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  // Every user now carries a tokenVersion (defaults to 0). It's embedded in
  // every issued access token's `tv` claim so logout-everywhere can
  // invalidate them by bumping the column.
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashedPassword',
    name: 'Test User',
    phone: '+1234567890',
    isActive: true,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      // findFirst is used by issueSessionForUserId to pull the latest
      // tokenVersion when one isn't passed in.
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    // logout-everywhere wraps the tokenVersion bump + token deletion in a
    // single DB transaction. The mock just resolves the promise array.
    $transaction: jest.fn((promises: Promise<any>[]) => Promise.all(promises)),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    // Re-install the default $transaction implementation after clearAllMocks.
    mockPrismaService.$transaction.mockImplementation((promises: Promise<any>[]) =>
      Promise.all(promises),
    );
  });

  describe('validateUser', () => {
    it('should return user without password hash when credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (HashUtils.comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBe('test@example.com');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should return null when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when user is inactive', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (HashUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return auth response with tokens when login is successful', async () => {
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).passwordHash;

      jest.spyOn(service, 'validateUser').mockResolvedValue(userWithoutPassword as any);
      jest.spyOn(service as any, 'generateTokens').mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      jest.spyOn(service as any, 'saveRefreshToken').mockResolvedValue(undefined);

      const result = await service.login({ email: 'test@example.com', password: 'password' });

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    it('should create user and return auth response', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (HashUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: 'New User',
        phone: '+1234567890',
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.account.create.mockResolvedValue({ id: 'acc-1' });
      jest.spyOn(service as any, 'generateTokens').mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      jest.spyOn(service as any, 'saveRefreshToken').mockResolvedValue(undefined);

      const result = await service.register('new@example.com', 'password', 'New User', '+1234567890');

      expect(result).toBeDefined();
      expect(result.user.email).toBe('new@example.com');
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          accountName: 'Main Account',
          accountType: 'BANK',
          balance: 0,
          isPrimary: true,
        },
      });
    });

    it('should throw BadRequestException when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register('test@example.com', 'password')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens when refresh token is valid', async () => {
      // The service stores hashes, so the lookup is by tokenHash, not the
      // raw token. Match that shape in the mock. The user object now also
      // includes tokenVersion which feeds the new access token's `tv` claim.
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'any-hash',
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      mockPrismaService.refreshToken.delete.mockResolvedValue({ id: 'rt-1' });
      jest.spyOn(service as any, 'generateTokens').mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      jest.spyOn(service as any, 'saveRefreshToken').mockResolvedValue(undefined);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
    });

    it('should throw UnauthorizedException when refresh token is expired', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'expired-hash',
        expiresAt: new Date(Date.now() - 86400000),
        user: mockUser,
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is not found', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete only the matching refresh token by hash when one is provided', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1', 'refresh-token');

      // Single-device logout: refresh token revoked, but tokenVersion is
      // NOT bumped — other devices' access tokens keep working.
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should bump tokenVersion AND delete all refresh tokens on logout-everywhere', async () => {
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, tokenVersion: 1 });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.logout('user-1');

      // Logout-everywhere: both operations must run inside a single
      // $transaction so we never end up with refresh tokens deleted but
      // tokenVersion not yet bumped (or vice versa).
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('generateTokens', () => {
    it('should embed the tv claim and sign both tokens', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      const realSecret = 'a'.repeat(40);
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REFRESH_TOKEN_SECRET') return realSecret;
        if (key === 'REFRESH_TOKEN_EXPIRES_IN') return '7d';
        return defaultValue;
      });

      const result = await (service as any).generateTokens('user-1', 'test@example.com', 5);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      // The access token payload (1st call) must carry tv so JwtStrategy
      // can reject revoked tokens. Refresh token (2nd call) carries it too
      // so a bumped tokenVersion can also invalidate refreshes mid-window.
      const [accessPayload] = mockJwtService.signAsync.mock.calls[0];
      const [refreshPayload] = mockJwtService.signAsync.mock.calls[1];
      expect(accessPayload).toMatchObject({ sub: 'user-1', email: 'test@example.com', tv: 5 });
      expect(refreshPayload).toMatchObject({ sub: 'user-1', email: 'test@example.com', tv: 5 });
    });
  });

  describe('saveRefreshToken', () => {
    it('should persist the SHA-256 hash of the refresh token, never the raw value', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      await (service as any).saveRefreshToken('user-1', 'refresh-token');

      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });
      const callArg = mockPrismaService.refreshToken.create.mock.calls[0][0].data;
      // SHA-256 hex digest is 64 chars and must NOT equal the raw token.
      expect(callArg.tokenHash).toHaveLength(64);
      expect(callArg.tokenHash).not.toBe('refresh-token');
    });
  });
});
