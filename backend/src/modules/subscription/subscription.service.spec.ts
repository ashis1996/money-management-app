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
        // Soft-delete filter is included by the service so tombstoned
        // subscriptions never leak.
        where: { userId: 'user-1', deletedAt: null },
        orderBy: { nextBillingDate: 'asc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([mockSubscription]);

      await service.findAll('user-1', 'ACTIVE');

      expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE', deletedAt: null },
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
    // Helpers — real Prisma rows expose `merchantName` and `transactionDate`,
    // not the legacy `merchant` / `date` shorthand. The detector reads those
    // exact field names; mocking the wrong shape silently returned [].
    const tx = (
      overrides: Partial<{
        id: string;
        merchantName: string | null;
        amount: number;
        transactionDate: Date;
      }>,
    ) => ({
      id: overrides.id ?? 'tx',
      merchantName: overrides.merchantName ?? null,
      amount: overrides.amount ?? 0,
      transactionDate: overrides.transactionDate ?? new Date(),
    });

    it('should detect monthly subscriptions', async () => {
      const transactions = [
        tx({
          id: 'tx-1',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-01-01'),
        }),
        tx({
          id: 'tx-2',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-02-01'),
        }),
        tx({
          id: 'tx-3',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-03-01'),
        }),
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
        tx({
          id: 'tx-1',
          merchantName: 'Uber',
          amount: 50,
          transactionDate: new Date('2024-01-01'),
        }),
        tx({
          id: 'tx-2',
          merchantName: 'Uber',
          amount: 50,
          transactionDate: new Date('2024-01-08'),
        }),
        tx({
          id: 'tx-3',
          merchantName: 'Uber',
          amount: 50,
          transactionDate: new Date('2024-01-15'),
        }),
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('WEEKLY');
    });

    it('should not detect subscriptions with insufficient occurrences', async () => {
      const transactions = [
        tx({
          id: 'tx-1',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-01-01'),
        }),
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(0);
    });

    it('should detect subscriptions with minimum confidence floor', async () => {
      // SUBSCRIPTION_DEFAULTS.DETECTION_THRESHOLD = 3, so we need at
      // least three matching merchant transactions. With three, base
      // confidence is 0.5 + 3*0.05 = 0.65 (capped); any boosting from
      // amount stability is on top of that. Wide-spread dates here so
      // the analyzer settles on QUARTERLY frequency rather than
      // rejecting the run, and amount variance is large so the
      // confidence stays near the floor.
      const transactions = [
        tx({
          id: 'tx-1',
          merchantName: 'Random',
          amount: 100,
          transactionDate: new Date('2024-01-01'),
        }),
        tx({
          id: 'tx-2',
          merchantName: 'Random',
          amount: 500,
          transactionDate: new Date('2024-04-01'),
        }),
        tx({
          id: 'tx-3',
          merchantName: 'Random',
          amount: 100,
          transactionDate: new Date('2024-07-01'),
        }),
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.detectSubscriptions('user-1');

      expect(result).toHaveLength(1);
      // Base confidence (0.5) plus the per-tx bump (3 × 0.05 = 0.15)
      // capped at +0.2; high variance means amount-stability boost is 0.
      expect(result[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should skip transactions without merchant', async () => {
      const transactions = [
        tx({
          id: 'tx-1',
          merchantName: null,
          amount: 100,
          transactionDate: new Date('2024-01-01'),
        }),
        tx({
          id: 'tx-2',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-01-01'),
        }),
        tx({
          id: 'tx-3',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-02-01'),
        }),
        tx({
          id: 'tx-4',
          merchantName: 'Netflix',
          amount: 199,
          transactionDate: new Date('2024-03-01'),
        }),
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
          // SubscriptionFrequency is a string-enum; the previous bare
          // string literal made TS reject the call. `as const` keeps the
          // literal type narrow without forcing tests to import the enum.
          frequency: 'MONTHLY' as const,
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
          frequency: 'MONTHLY' as const,
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
          // The service includes deletedAt: null so soft-deleted
          // subscriptions don't appear in upcoming-payment reminders.
          deletedAt: null,
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
