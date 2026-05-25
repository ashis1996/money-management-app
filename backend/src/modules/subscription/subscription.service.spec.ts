import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: PrismaService;
  let rabbitMQ: RabbitMQService;

  const mockSubscription = {
    id: 'sub-1',
    userId: 'user-1',
    name: 'Netflix',
    merchant: 'netflix',
    amount: 199,
    frequency: 'MONTHLY',
    status: 'ACTIVE',
    nextBillingDate: new Date('2024-02-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    subscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  const mockRabbitMQService = {
    publishSubscriptionDetected: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitMQ = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new subscription', async () => {
      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

      const result = await service.create('user-1', {
        name: 'Netflix',
        merchant: 'netflix',
        amount: 199,
        frequency: 'MONTHLY',
        nextBillingDate: '2024-02-01',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Netflix');
      expect(mockPrismaService.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Netflix',
          amount: 199,
          frequency: 'MONTHLY',
          nextBillingDate: expect.any(Date),
        }),
      });
    });

    it('should handle null nextBillingDate', async () => {
      mockPrismaService.subscription.create.mockResolvedValue({
        ...mockSubscription,
        nextBillingDate: null,
      });

      await service.create('user-1', {
        name: 'Netflix',
        merchant: 'netflix',
        amount: 199,
        frequency: 'MONTHLY',
      });

      expect(mockPrismaService.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nextBillingDate: null,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all subscriptions for user', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { nextBillingDate: 'asc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([mockSubscription]);

      await service.findAll('user-1', 'ACTIVE');

      expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
        orderBy: { nextBillingDate: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return subscription by id', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await service.findOne('user-1', 'sub-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sub-1');
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        amount: 299,
      });

      const result = await service.update('user-1', 'sub-1', { amount: 299 });

      expect(result.amount).toBe(299);
    });

    it('should convert nextBillingDate to Date', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue(mockSubscription);

      await service.update('user-1', 'sub-1', { nextBillingDate: '2024-03-01' });

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          nextBillingDate: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.delete.mockResolvedValue(mockSubscription);

      const result = await service.delete('user-1', 'sub-1');

      expect(result.message).toBe('Subscription deleted successfully');
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('detectSubscriptions', () => {
    it('should detect monthly subscriptions', async () => {
      const transactions = [
        { id: 'tx-1', merchant: 'Netflix', amount: 199, date: new Date('2024-01-01') },
        { id: 'tx-2', merchant: 'Netflix', amount: 199, date: new Date('2024-02-01') },
        { id: 'tx-3', merchant: 'Netflix', amount: 199, date: new Date('2024-03-01') },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('netflix');
      expect(result[0].frequency).toBe('MONTHLY');
      expect(result[0].amount).toBe(199);
      expect(result[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect weekly subscriptions', async () => {
      const transactions = [
        { id: 'tx-1', merchant: 'Uber', amount: 50, date: new Date('2024-01-01') },
        { id: 'tx-2', merchant: 'Uber', amount: 50, date: new Date('2024-01-08') },
        { id: 'tx-3', merchant: 'Uber', amount: 50, date: new Date('2024-01-15') },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('WEEKLY');
    });

    it('should not detect subscriptions with insufficient occurrences', async () => {
      const transactions = [
        { id: 'tx-1', merchant: 'Netflix', amount: 199, date: new Date('2024-01-01') },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(0);
    });

    it('should detect subscriptions with minimum confidence floor', async () => {
      // With 2 transactions, base confidence is 0.5 + 0.1 = 0.6
      const transactions = [
        { id: 'tx-1', merchant: 'Random', amount: 100, date: new Date('2024-01-01') },
        { id: 'tx-2', merchant: 'Random', amount: 500, date: new Date('2024-06-15') },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.6);
    });

    it('should skip transactions without merchant', async () => {
      const transactions = [
        { id: 'tx-1', merchant: null, amount: 100, date: new Date('2024-01-01') },
        { id: 'tx-2', merchant: 'Netflix', amount: 199, date: new Date('2024-01-01') },
        { id: 'tx-3', merchant: 'Netflix', amount: 199, date: new Date('2024-02-01') },
        { id: 'tx-4', merchant: 'Netflix', amount: 199, date: new Date('2024-03-01') },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('netflix');
    });
  });

  describe('saveDetectedSubscriptions', () => {
    it('should create new subscriptions', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

      const detected = [
        {
          merchant: 'netflix',
          amount: 199,
          frequency: 'MONTHLY',
          confidence: 0.9,
          transactionIds: ['tx-1', 'tx-2'],
          firstTransactionDate: new Date('2024-01-01'),
          lastTransactionDate: new Date('2024-02-01'),
        },
      ];

      const result = await service.saveDetectedSubscriptions('user-1', detected);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.subscription.create).toHaveBeenCalled();
      expect(mockRabbitMQService.publishSubscriptionDetected).toHaveBeenCalled();
    });

    it('should update existing subscriptions', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        amount: 299,
      });

      const detected = [
        {
          merchant: 'netflix',
          amount: 299,
          frequency: 'MONTHLY',
          confidence: 0.9,
          transactionIds: ['tx-1'],
          firstTransactionDate: new Date('2024-01-01'),
          lastTransactionDate: new Date('2024-02-01'),
        },
      ];

      const result = await service.saveDetectedSubscriptions('user-1', detected);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { amount: 299, frequency: 'MONTHLY' },
      });
    });
  });

  describe('getUpcomingPayments', () => {
    it('should return upcoming payments within default 7 days', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.getUpcomingPayments('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: 'ACTIVE',
          nextBillingDate: {
            lte: expect.any(Date),
          },
        },
        orderBy: { nextBillingDate: 'asc' },
      });
    });

    it('should respect custom days parameter', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      await service.getUpcomingPayments('user-1', 30);

      const callArg = mockPrismaService.subscription.findMany.mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      expect(callArg.where.nextBillingDate.lte.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('getSummary', () => {
    it('should calculate total monthly spend correctly', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([
        { ...mockSubscription, amount: 199, frequency: 'MONTHLY' },
        { ...mockSubscription, id: 'sub-2', amount: 50, frequency: 'WEEKLY' },
        { ...mockSubscription, id: 'sub-3', amount: 1200, frequency: 'YEARLY' },
        { ...mockSubscription, id: 'sub-4', amount: 10, frequency: 'DAILY' },
        { ...mockSubscription, id: 'sub-5', amount: 300, frequency: 'QUARTERLY' },
      ]);
      jest.spyOn(service, 'getUpcomingPayments').mockResolvedValue([]);

      const result = await service.getSummary('user-1');

      expect(result.totalSubscriptions).toBe(5);
      // Monthly: 199 + (50*4) + (1200/12) + (10*30) + (300/3) = 199 + 200 + 100 + 300 + 100 = 899
      expect(result.totalMonthlySpend).toBe(899);
    });
  });

  describe('cancelSubscription', () => {
    it('should update status to CANCELLED', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });

      const result = await service.cancelSubscription('user-1', 'sub-1');

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('pauseSubscription', () => {
    it('should update status to PAUSED', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'PAUSED',
      });

      const result = await service.pauseSubscription('user-1', 'sub-1');

      expect(result.status).toBe('PAUSED');
    });
  });

  describe('resumeSubscription', () => {
    it('should update status to ACTIVE', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'PAUSED',
      });
      mockPrismaService.subscription.update.mockResolvedValue(mockSubscription);

      const result = await service.resumeSubscription('user-1', 'sub-1');

      expect(result.status).toBe('ACTIVE');
    });
  });
});
