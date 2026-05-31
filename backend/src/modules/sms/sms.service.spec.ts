import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';

jest.mock('../../common/utils/logger');

describe('SmsService', () => {
  let service: SmsService;
  let prisma: PrismaService;
  let rabbitMQ: RabbitMQService;

  const mockSmsLog = {
    id: 'sms-1',
    userId: 'user-1',
    body: 'Your account has been debited INR 500 at Amazon. Available balance: INR 9500.',
    sender: 'HD-BANK',
    phoneNumber: '+1234567890',
    receivedAt: new Date(),
    isProcessed: false,
    parsedData: null,
    transactionId: null,
    createdAt: new Date(),
  };

  // The new ingest flow upserts on (userId, externalReferenceId). A "fresh"
  // upsert returns a row whose createdAt === updatedAt; the service uses
  // that to decide whether to publish `transaction.created`.
  const freshNow = new Date('2026-05-01T00:00:00Z');
  const mockTransaction = {
    id: 'tx-1',
    userId: 'user-1',
    amount: 500,
    type: 'DEBIT',
    category: 'SHOPPING',
    merchant: 'Amazon',
    date: new Date(),
    rawSms: 'Your account has been debited INR 500 at Amazon.',
    smsId: 'sms-1',
    createdAt: freshNow,
    updatedAt: freshNow,
  };

  const mockPrismaService = {
    smsLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      // Dedup short-circuit reads via findUnique on the unique compound
      // (userId, externalReferenceId). Returning null means "no duplicate";
      // tests that want to exercise the short-circuit override per-test.
      findUnique: jest.fn().mockResolvedValue(null),
      // The actual write path is upsert with the dedup key.
      upsert: jest.fn(),
      // Kept around for any leftover test that still mocks .create — the
      // production code no longer calls it for SMS-derived transactions.
      create: jest.fn(),
    },
  };

  const mockRabbitMQService = {
    publishSmsReceived: jest.fn().mockResolvedValue(undefined),
    publishTransactionCreated: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    // Default to disabling the AI parser in unit tests so we exercise the
    // local regex path that the existing assertions are written against.
    get: jest.fn().mockImplementation((key: string, fallback?: any) => {
      if (key === 'SMS_USE_AI_PARSER') return 'false';
      if (key === 'AI_SERVICE_URL') return 'http://localhost:8000/api/v1';
      return fallback;
    }),
  };

  const mockAiProxyService = {
    parseSms: jest.fn().mockRejectedValue(new Error('AI disabled in tests')),
    callAi: jest.fn().mockRejectedValue(new Error('AI disabled in tests')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiProxyService, useValue: mockAiProxyService },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitMQ = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
    // Re-install dedup default after clearAllMocks since it's a stateful
    // mock function.
    mockPrismaService.transaction.findUnique.mockResolvedValue(null);
  });

  describe('ingestSms', () => {
    it('should parse SMS and create transaction for debit message', async () => {
      mockPrismaService.smsLog.create.mockResolvedValue(mockSmsLog);
      mockPrismaService.smsLog.update.mockResolvedValue({ ...mockSmsLog, isProcessed: true });
      mockPrismaService.transaction.upsert.mockResolvedValue(mockTransaction);

      const result = await service.ingestSms('user-1', {
        body: 'Your account has been debited INR 500 at Amazon; Avl Bal INR 9500',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.transactionCreated).toBe(true);
      expect(result.transactionId).toBe('tx-1');
      expect(result.parsed.amount).toBe(500);
      expect(result.parsed.transactionType).toBe('DEBIT');
      expect(result.parsed.merchant).toBe('Amazon');

      // Critical: the upsert went through the dedup key, not a plain create.
      expect(mockPrismaService.transaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_externalReferenceId: expect.objectContaining({
              userId: 'user-1',
              externalReferenceId: expect.any(String),
            }),
          }),
        }),
      );
      // The plain create path is no longer used for SMS-derived transactions.
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should be idempotent: a duplicate SMS reuses the existing transaction', async () => {
      // First ingest landed already; the dedup short-circuit returns the
      // stored transaction without touching smsLog or upsert.
      const existing = {
        id: 'tx-existing',
        userId: 'user-1',
        amount: 500,
        type: 'DEBIT',
        merchantName: 'Amazon',
        categoryId: 'SHOPPING',
        aiConfidence: null,
      };
      mockPrismaService.transaction.findUnique.mockResolvedValueOnce(existing);

      const result = await service.ingestSms('user-1', {
        body: 'Your account has been debited INR 500 at Amazon; Avl Bal INR 9500',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        timestamp: new Date('2026-05-01T00:00:00Z').toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.transactionCreated).toBe(false);
      expect(result.transactionId).toBe('tx-existing');
      // No SmsLog row created, no upsert, no publish.
      expect(mockPrismaService.smsLog.create).not.toHaveBeenCalled();
      expect(mockPrismaService.transaction.upsert).not.toHaveBeenCalled();
      expect(mockRabbitMQService.publishTransactionCreated).not.toHaveBeenCalled();
    });

    it('should NOT publish transaction.created when upsert returns an existing row (race)', async () => {
      // Concurrent racer: upsert no-ops on the matching row; createdAt and
      // updatedAt diverge, so the service must NOT re-publish.
      const concurrent = {
        ...mockTransaction,
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-01T00:00:30Z'),
      };
      mockPrismaService.smsLog.create.mockResolvedValue(mockSmsLog);
      mockPrismaService.smsLog.update.mockResolvedValue({ ...mockSmsLog, isProcessed: true });
      mockPrismaService.transaction.upsert.mockResolvedValue(concurrent);

      const result = await service.ingestSms('user-1', {
        body: 'Your account has been debited INR 500 at Amazon',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        timestamp: new Date().toISOString(),
      });

      expect(result.transactionCreated).toBe(false);
      expect(mockRabbitMQService.publishTransactionCreated).not.toHaveBeenCalled();
    });

    it('should parse SMS and create transaction for credit message', async () => {
      mockPrismaService.smsLog.create.mockResolvedValue(mockSmsLog);
      mockPrismaService.smsLog.update.mockResolvedValue({ ...mockSmsLog, isProcessed: true });
      mockPrismaService.transaction.upsert.mockResolvedValue({
        ...mockTransaction,
        type: 'CREDIT',
        amount: 1000,
      });

      const result = await service.ingestSms('user-1', {
        body: 'INR 1,000 has been credited to your account from Employer Pvt Ltd.',
        sender: 'ICICIB',
        phoneNumber: '+1234567890',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.parsed.transactionType).toBe('CREDIT');
      expect(result.parsed.amount).toBe(1000);
    });

    it('should not create transaction when amount is not found', async () => {
      mockPrismaService.smsLog.create.mockResolvedValue(mockSmsLog);
      mockPrismaService.smsLog.update.mockResolvedValue({ ...mockSmsLog, isProcessed: true });

      const result = await service.ingestSms('user-1', {
        body: 'Your OTP is 123456. Do not share it with anyone.',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.transactionCreated).toBe(false);
      expect(mockPrismaService.transaction.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should handle transaction creation failure gracefully', async () => {
      mockPrismaService.smsLog.create.mockResolvedValue(mockSmsLog);
      mockPrismaService.smsLog.update.mockResolvedValue({ ...mockSmsLog, isProcessed: true });
      mockPrismaService.transaction.upsert.mockRejectedValue(new Error('DB Error'));

      const result = await service.ingestSms('user-1', {
        body: 'Debited INR 500 at Amazon.',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.transactionCreated).toBe(false);
    });
  });

  describe('parseSms', () => {
    it('should extract amount with INR symbol', async () => {
      const result = await service.parseSms(
        'Your account has been debited INR 1,234.50 at Starbucks.',
        'HD-BANK',
        new Date(),
      );

      expect(result.amount).toBe(1234.50);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract amount with Rs symbol', async () => {
      const result = await service.parseSms(
        'Rs. 500 debited from your account at Zomato.',
        'HDFCBK',
        new Date(),
      );

      expect(result.amount).toBe(500);
    });

    it('should identify CREDIT transaction type', async () => {
      const result = await service.parseSms(
        'Your account has been credited with INR 5000 refund from Amazon.',
        'HD-BANK',
        new Date(),
      );

      expect(result.transactionType).toBe('CREDIT');
    });

    it('should identify DEBIT transaction type', async () => {
      const result = await service.parseSms(
        'Your account has been debited INR 500 at Swiggy.',
        'HD-BANK',
        new Date(),
      );

      expect(result.transactionType).toBe('DEBIT');
    });

    it('should extract merchant name', async () => {
      const result = await service.parseSms(
        'Transaction of INR 1000 at Netflix',
        'AXISBK',
        new Date(),
      );

      expect(result.merchant).toBe('Netflix');
    });

    it('should categorize FOOD_DINING transactions', async () => {
      const result = await service.parseSms(
        'Debited INR 200 at Pizza Hut.',
        'SBIBNK',
        new Date(),
      );

      expect(result.category).toBe('FOOD_DINING');
    });

    it('should categorize SUBSCRIPTION transactions', async () => {
      const result = await service.parseSms(
        'Monthly subscription of INR 199 charged by AWS.',
        'ICICIB',
        new Date(),
      );

      expect(result.category).toBe('SUBSCRIPTION');
    });

    it('should categorize SHOPPING transactions', async () => {
      const result = await service.parseSms(
        'INR 1500 paid to Amazon for order #12345.',
        'HD-BANK',
        new Date(),
      );

      expect(result.category).toBe('SHOPPING');
    });

    it('should categorize TRANSFER transactions', async () => {
      const result = await service.parseSms(
        'UPI transfer of INR 500 to John Doe completed.',
        'HDFCBK',
        new Date(),
      );

      expect(result.category).toBe('TRANSFER');
    });

    it('should extract account last 4 digits', async () => {
      const result = await service.parseSms(
        'Transaction on card ending 4242 for INR 1000.',
        'AXISBK',
        new Date(),
      );

      expect(result.accountLast4).toBe('4242');
    });

    it('should extract available balance', async () => {
      const result = await service.parseSms(
        'Debited INR 500. Available balance is 9,500.50.',
        'HD-BANK',
        new Date(),
      );

      expect(result.balance).toBe(9500.50);
    });

    it('should identify bank from sender', async () => {
      const result = await service.parseSms('Test', 'HD-BANK', new Date());

      // bank is not included in ParsedSmsDto output
      expect(result).toBeDefined();
    });

    it('should handle unknown senders', async () => {
      const result = await service.parseSms('Test', 'UNKNOWN', new Date());

      expect(result.bank).toBeUndefined();
    });
  });

  describe('getUnprocessedSms', () => {
    it('should return unprocessed SMS messages', async () => {
      mockPrismaService.smsLog.findMany.mockResolvedValue([mockSmsLog]);

      const result = await service.getUnprocessedSms('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.smsLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isProcessed: false },
        take: 100,
        orderBy: { receivedAt: 'desc' },
      });
    });

    it('should respect limit parameter', async () => {
      mockPrismaService.smsLog.findMany.mockResolvedValue([]);

      await service.getUnprocessedSms('user-1', 50);

      expect(mockPrismaService.smsLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('getSmsHistory', () => {
    it('should return paginated SMS history', async () => {
      mockPrismaService.smsLog.count.mockResolvedValue(25);
      mockPrismaService.smsLog.findMany.mockResolvedValue([mockSmsLog]);

      const result = await service.getSmsHistory('user-1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);
      expect(mockPrismaService.smsLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 10,
        orderBy: { receivedAt: 'desc' },
        include: {
          transaction: {
            select: { id: true, amount: true, category: true },
          },
        },
      });
    });
  });
});
