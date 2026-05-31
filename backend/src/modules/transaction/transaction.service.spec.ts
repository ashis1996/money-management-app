import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { TransactionType } from '@money-management/shared/dto';

/**
 * Transaction service tests.
 *
 * The previous version of this spec was written against an older schema
 * that used `category` / `merchant` / `date` field names. The current
 * Prisma columns are `categoryId` / `merchantName` / `transactionDate`,
 * and `findAll` now returns a `{data, meta}` paginated envelope (see
 * the high-severity batch). This file was rewritten to reflect those
 * names and to remove the silent type coercions that were hiding the
 * mismatch.
 */
describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: PrismaService;
  let rabbitMQ: RabbitMQService;

  const mockTransaction = {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    amount: 100.5,
    type: 'DEBIT',
    // Use the canonical Prisma column names so assertions are honest.
    categoryId: 'FOOD_DINING',
    merchantName: 'Restaurant',
    description: 'Lunch at restaurant',
    transactionDate: new Date(),
    rawSmsText: null,
    isSubscription: false,
    subscriptionId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
  };

  const mockRabbitMQService = {
    publishTransactionCreated: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitMQ = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create transaction and publish event', async () => {
      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.create('user-1', {
        accountId: 'acc-1',
        amount: 100.5,
        type: TransactionType.DEBIT,
        // The DTO accepts both `category` (legacy) and `categoryId`.
        // We send the canonical name to keep the assertion below clean.
        categoryId: 'FOOD_DINING',
        description: 'Lunch',
        merchantName: 'Restaurant',
        transactionDate: new Date().toISOString(),
      });

      expect(result).toBeDefined();
      // The service maps DTO → Prisma column names, so the call sees
      // `categoryId` / `merchantName`, not the DTO aliases.
      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          amount: 100.5,
          type: 'DEBIT',
          categoryId: 'FOOD_DINING',
          merchantName: 'Restaurant',
        }),
      });
      // Published event flattens categoryId → category for downstream
      // consumers; the mockTransaction provides the categoryId value.
      expect(mockRabbitMQService.publishTransactionCreated).toHaveBeenCalledWith({
        transactionId: 'tx-1',
        userId: 'user-1',
        amount: 100.5,
        category: 'FOOD_DINING',
      });
    });

    it('should mark as subscription when subscriptionId is provided', async () => {
      mockPrismaService.transaction.create.mockResolvedValue({
        ...mockTransaction,
        isSubscription: true,
        subscriptionId: 'sub-1',
      });

      await service.create('user-1', {
        accountId: 'acc-1',
        amount: 100.5,
        type: TransactionType.DEBIT,
        subscriptionId: 'sub-1',
        transactionDate: new Date().toISOString(),
      });

      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isSubscription: true,
          subscriptionId: 'sub-1',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions with filters', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', {
        from: '2024-01-01',
        to: '2024-12-31',
        category: 'FOOD_DINING',
        minAmount: 50,
        maxAmount: 200,
        search: 'restaurant',
      });

      // Paginated envelope, not a bare array.
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          deletedAt: null,
          // Service uses `transactionDate` (column name), not the legacy
          // `date` shorthand from the DTO.
          transactionDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          categoryId: 'FOOD_DINING',
          amount: {
            gte: 50,
            lte: 200,
          },
          // Search OR uses `merchantName` (column name).
          OR: [
            { description: { contains: 'restaurant', mode: 'insensitive' } },
            { merchantName: { contains: 'restaurant', mode: 'insensitive' } },
          ],
        }),
        orderBy: { transactionDate: 'desc' },
        // Account select uses the renamed columns.
        include: { account: { select: { accountName: true, accountType: true } } },
        skip: 0,
        take: 20,
      });
    });

    it('should return paginated transactions when no filters provided', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', {});

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        // The middleware-injected deletedAt:null flows through here too.
        where: { userId: 'user-1', deletedAt: null },
        orderBy: { transactionDate: 'desc' },
        include: { account: { select: { accountName: true, accountType: true } } },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('findOne', () => {
    it('should return transaction by id', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.findOne('user-1', 'tx-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('tx-1');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update transaction', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrismaService.transaction.update.mockResolvedValue({
        ...mockTransaction,
        description: 'Updated description',
      });

      const result = await service.update('user-1', 'tx-1', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { description: 'Updated description' },
      });
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft-delete transaction', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrismaService.transaction.update.mockResolvedValue({
        ...mockTransaction,
        deletedAt: new Date(),
      });

      const result = await service.delete('user-1', 'tx-1');

      expect(result.message).toMatch(/deleted/i);
      // Service performs a soft-delete via update, not a hard delete.
      // The where clause + data: deletedAt is the tombstone, allowing the
      // soft-delete middleware to filter it out of subsequent reads.
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategories', () => {
    it('should return category breakdown keyed by categoryId', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { categoryId: 'FOOD_DINING', _sum: { amount: 5000 }, _count: { id: 10 } },
        { categoryId: 'SHOPPING', _sum: { amount: 3000 }, _count: { id: 5 } },
      ]);

      const result = await service.getCategories('user-1', new Date('2024-01-01'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        categoryId: 'FOOD_DINING',
        totalAmount: 5000,
        transactionCount: 10,
      });
    });

    it("should fall back to 'Uncategorized' for null categories", async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { categoryId: null, _sum: { amount: 1000 }, _count: { id: 2 } },
      ]);

      const result = await service.getCategories('user-1');

      expect(result[0].categoryId).toBe('Uncategorized');
    });
  });

  describe('getMonthlyStats', () => {
    it('should return monthly statistics', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { type: 'CREDIT', amount: 5000 },
        { type: 'DEBIT', amount: 2000 },
        { type: 'DEBIT', amount: 1000 },
      ]);

      const result = await service.getMonthlyStats('user-1', 2024, 1);

      expect(result).toEqual({
        year: 2024,
        month: 1,
        income: 5000,
        expense: 3000,
        netSavings: 2000,
        transactionCount: 3,
      });
    });

    it('should handle no transactions', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyStats('user-1', 2024, 1);

      expect(result.income).toBe(0);
      expect(result.expense).toBe(0);
      expect(result.netSavings).toBe(0);
    });
  });

  describe('search', () => {
    it('should search transactions with limit', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);

      const result = await service.search('user-1', 'restaurant', 5);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          deletedAt: null,
          OR: [
            { description: { contains: 'restaurant', mode: 'insensitive' } },
            // Service searches `merchantName`, the actual column.
            { merchantName: { contains: 'restaurant', mode: 'insensitive' } },
          ],
        },
        take: 5,
        // Stable order by the canonical date column.
        orderBy: { transactionDate: 'desc' },
      });
    });
  });
});
