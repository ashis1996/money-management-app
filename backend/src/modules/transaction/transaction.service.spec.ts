import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: PrismaService;
  let rabbitMQ: RabbitMQService;

  const mockTransaction = {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    amount: 100.50,
    type: 'DEBIT',
    category: 'FOOD_DINING',
    description: 'Lunch at restaurant',
    merchant: 'Restaurant',
    date: new Date(),
    rawSms: null,
    isSubscription: false,
    subscriptionId: null,
    smsId: null,
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
        amount: 100.50,
        type: 'DEBIT',
        category: 'FOOD_DINING',
        description: 'Lunch',
        merchant: 'Restaurant',
        date: new Date().toISOString(),
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          amount: 100.50,
          type: 'DEBIT',
          category: 'FOOD_DINING',
        }),
      });
      expect(mockRabbitMQService.publishTransactionCreated).toHaveBeenCalledWith({
        transactionId: 'tx-1',
        userId: 'user-1',
        amount: 100.50,
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
        amount: 100.50,
        type: 'DEBIT',
        subscriptionId: 'sub-1',
        date: new Date().toISOString(),
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
    it('should return transactions with filters', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);

      const result = await service.findAll('user-1', {
        from: '2024-01-01',
        to: '2024-12-31',
        category: 'FOOD_DINING',
        minAmount: 50,
        maxAmount: 200,
        search: 'restaurant',
      });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          category: 'FOOD_DINING',
          amount: {
            gte: 50,
            lte: 200,
          },
          OR: [
            { description: { contains: 'restaurant', mode: 'insensitive' } },
            { merchant: { contains: 'restaurant', mode: 'insensitive' } },
          ],
        }),
        orderBy: { date: 'desc' },
        include: { account: { select: { name: true, type: true } } },
      });
    });

    it('should return all transactions when no filters provided', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);

      await service.findAll('user-1', {});

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: { account: { select: { name: true, type: true } } },
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
    it('should delete transaction', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrismaService.transaction.delete.mockResolvedValue(mockTransaction);

      const result = await service.delete('user-1', 'tx-1');

      expect(result.message).toBe('Transaction deleted successfully');
      expect(mockPrismaService.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategories', () => {
    it('should return category breakdown', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { category: 'FOOD_DINING', _sum: { amount: 5000 }, _count: { id: 10 } },
        { category: 'SHOPPING', _sum: { amount: 3000 }, _count: { id: 5 } },
      ]);

      const result = await service.getCategories('user-1', new Date('2024-01-01'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        category: 'FOOD_DINING',
        totalAmount: 5000,
        transactionCount: 10,
      });
    });

    it('should handle null categories', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { category: null, _sum: { amount: 1000 }, _count: { id: 2 } },
      ]);

      const result = await service.getCategories('user-1');

      expect(result[0].category).toBe('Uncategorized');
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
          OR: [
            { description: { contains: 'restaurant', mode: 'insensitive' } },
            { merchant: { contains: 'restaurant', mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { date: 'desc' },
      });
    });

    it('should use default limit of 10', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);

      await service.search('user-1', 'query');

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
