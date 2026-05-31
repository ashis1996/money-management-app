import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HashUtils } from '../../common/utils/hash';

jest.mock('../../common/utils/hash');

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashedPassword',
    name: 'Test User',
    phone: '+1234567890',
    emailVerified: false,
    phoneVerified: false,
    avatarUrl: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    notificationPrefs: null,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // Password updates revoke every outstanding refresh token. The mock
    // resolves the deleteMany to a benign result so the test still
    // reaches the post-update assertion.
    refreshToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
    },
    notification: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
        // UserService writes USER_PASSWORD_CHANGED / USER_DELETE_SELF /
        // USER_DATA_EXPORT audit rows. The mock just absorbs them so the
        // unit tests don't require a real PrismaService write path.
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with default account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (HashUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.account.create.mockResolvedValue({ id: 'acc-1' });

      const result = await service.create({
        email: 'new@example.com',
        password: 'password',
        name: 'New User',
        phone: '+1234567890',
      });

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
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

    it('should throw ConflictException when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when phone already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);

      await expect(
        service.create({ email: 'new@example.com', password: 'password', phone: '+1234567890' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user with password hash by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.passwordHash).toBe('hashedPassword');
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await service.update('user-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should hash password when updating password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (HashUtils.hashPassword as jest.Mock).mockResolvedValue('newHashedPassword');
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.update('user-1', { password: 'newpassword' });

      expect(HashUtils.hashPassword).toHaveBeenCalledWith('newpassword');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ passwordHash: 'newHashedPassword' }),
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException when updating to existing email', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, id: 'user-2' });

      await expect(service.update('user-1', { email: 'other@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.updateLastLogin('user-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email', async () => {
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, emailVerified: true });

      const result = await service.verifyEmail('user-1');

      expect(result.emailVerified).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
        select: expect.any(Object),
      });
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await service.delete('user-1');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      mockPrismaService.account.findMany.mockResolvedValue([
        { balance: 1000, type: 'BANK' },
        { balance: 500, type: 'WALLET' },
      ]);
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { type: 'CREDIT', _sum: { amount: 5000 } },
        { type: 'DEBIT', _sum: { amount: 3000 } },
      ]);
      mockPrismaService.subscription.count.mockResolvedValue(3);
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getDashboardStats('user-1');

      expect(result).toBeDefined();
      expect(result.totalBalance).toBe(1500);
      expect(result.monthlyIncome).toBe(5000);
      expect(result.monthlyExpense).toBe(3000);
      expect(result.netSavings).toBe(2000);
      expect(result.accountCount).toBe(2);
      expect(result.activeSubscriptions).toBe(3);
      expect(result.unreadNotifications).toBe(5);
    });

    it('should handle zero values gracefully', async () => {
      mockPrismaService.account.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.groupBy.mockResolvedValue([]);
      mockPrismaService.subscription.count.mockResolvedValue(0);
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getDashboardStats('user-1');

      expect(result.totalBalance).toBe(0);
      expect(result.monthlyIncome).toBe(0);
      expect(result.monthlyExpense).toBe(0);
      expect(result.netSavings).toBe(0);
    });
  });
});
