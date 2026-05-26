import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { InsightsService } from './insights.service';
import { PrismaService } from '../../config/prisma.service';
import { InsightPeriod } from '@money-management/shared/dto';

describe('InsightsService', () => {
  let service: InsightsService;
  let prisma: PrismaService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockTransaction = (overrides = {}) => ({
    id: 'tx-1',
    userId: 'user-1',
    amount: 100,
    type: 'DEBIT',
    category: 'FOOD_DINING',
    merchant: 'Restaurant',
    date: new Date(),
    ...overrides,
  });

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:8000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
    prisma = module.get<PrismaService>(PrismaService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('getSpendingInsights', () => {
    it('should return spending insights for current period', async () => {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);

      mockPrismaService.transaction.findMany
        .mockResolvedValueOnce([
          mockTransaction({ type: 'DEBIT', amount: 5000, category: 'FOOD_DINING' }),
          mockTransaction({ type: 'DEBIT', amount: 3000, category: 'SHOPPING' }),
          mockTransaction({ type: 'CREDIT', amount: 10000 }),
        ])
        .mockResolvedValueOnce([
          mockTransaction({ type: 'DEBIT', amount: 4000, category: 'FOOD_DINING' }),
          mockTransaction({ type: 'DEBIT', amount: 2500, category: 'SHOPPING' }),
          mockTransaction({ type: 'CREDIT', amount: 9000 }),
        ]);
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { category: 'FOOD_DINING', _sum: { amount: 5000 }, _count: { id: 5 } },
        { category: 'SHOPPING', _sum: { amount: 3000 }, _count: { id: 3 } },
      ]);

      const result = await service.getSpendingInsights('user-1', InsightPeriod.MONTH);

      expect(result).toBeDefined();
      expect(result.period).toBe(InsightPeriod.MONTH);
      expect(result.totalSpent).toBe(8000);
      expect(result.totalIncome).toBe(10000);
      expect(result.netSavings).toBe(2000);
      expect(result.savingsRate).toBe(20);
      expect(result.byCategory).toHaveLength(2);
      expect(result.comparisonToPrevious.spentChange).toBeGreaterThan(0);
    });

    it('should handle zero income gracefully', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getSpendingInsights('user-1', InsightPeriod.MONTH);

      expect(result.savingsRate).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.totalIncome).toBe(0);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should calculate category percentages', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { category: 'FOOD_DINING', _sum: { amount: 6000 }, _count: { id: 6 } },
        { category: 'SHOPPING', _sum: { amount: 4000 }, _count: { id: 4 } },
      ]);

      const result = await (service as any).getCategoryBreakdown('user-1', new Date(), new Date());

      expect(result).toHaveLength(2);
      expect(result[0].percentage).toBe(60);
      expect(result[1].percentage).toBe(40);
    });

    it('should handle zero total', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([]);

      const result = await (service as any).getCategoryBreakdown('user-1', new Date(), new Date());

      expect(result).toHaveLength(0);
    });
  });

  describe('getTopMerchants', () => {
    it('should return top merchants sorted by amount', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { merchant: 'Amazon', _sum: { amount: 10000 }, _count: { id: 10 } },
        { merchant: 'Zomato', _sum: { amount: 5000 }, _count: { id: 5 } },
        { merchant: 'Uber', _sum: { amount: 3000 }, _count: { id: 3 } },
      ]);

      const result = await (service as any).getTopMerchants('user-1', new Date(), new Date(), 5);

      expect(result).toHaveLength(3);
      expect(result[0].merchant).toBe('Amazon');
      expect(result[0].amount).toBe(10000);
    });

    it('should limit results to specified limit', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { merchant: 'A', _sum: { amount: 1000 }, _count: { id: 1 } },
        { merchant: 'B', _sum: { amount: 900 }, _count: { id: 1 } },
        { merchant: 'C', _sum: { amount: 800 }, _count: { id: 1 } },
      ]);

      const result = await (service as any).getTopMerchants('user-1', new Date(), new Date(), 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getDateRange', () => {
    it('should return correct week range', () => {
      const now = new Date('2024-01-15');
      const result = (service as any).getDateRange(InsightPeriod.WEEK, now);

      expect(result.startDate.getDate()).toBe(8);
      expect(result.previousStartDate.getDate()).toBe(1);
    });

    it('should return correct month range', () => {
      const now = new Date('2024-01-15');
      const result = (service as any).getDateRange(InsightPeriod.MONTH, now);

      expect(result.startDate.getMonth()).toBe(11); // December
      expect(result.previousStartDate.getMonth()).toBe(10); // November
    });

    it('should return correct quarter range', () => {
      const now = new Date('2024-01-15');
      const result = (service as any).getDateRange(InsightPeriod.QUARTER, now);

      expect(result.startDate.getMonth()).toBe(9); // October
      expect(result.previousStartDate.getMonth()).toBe(6); // July
    });

    it('should return correct year range', () => {
      const now = new Date('2024-01-15');
      const result = (service as any).getDateRange(InsightPeriod.YEAR, now);

      expect(result.startDate.getFullYear()).toBe(2023);
      expect(result.previousStartDate.getFullYear()).toBe(2022);
    });
  });

  describe('getRecommendations', () => {
    it('should recommend reviewing high spending categories', async () => {
      jest.spyOn(service, 'getSpendingInsights').mockResolvedValue({
        period: InsightPeriod.MONTH,
        totalSpent: 10000,
        totalIncome: 20000,
        netSavings: 10000,
        savingsRate: 50,
        byCategory: [
          { category: 'FOOD_DINING', amount: 5000, percentage: 50, transactionCount: 10, averageTransaction: 500, changeFromPrevious: 0 },
          { category: 'SHOPPING', amount: 3000, percentage: 30, transactionCount: 5, averageTransaction: 600, changeFromPrevious: 0 },
        ],
        topMerchants: [],
        dailyAverage: 333,
        monthlyAverage: 10000,
        comparisonToPrevious: { spentChange: 0, incomeChange: 0, savingsChange: 0 },
      } as any);

      const result = await service.getRecommendations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('SPENDING_ANALYSIS');
      expect(result[0].priority).toBe('HIGH');
    });

    it('should recommend improving savings rate', async () => {
      jest.spyOn(service, 'getSpendingInsights').mockResolvedValue({
        period: InsightPeriod.MONTH,
        totalSpent: 9000,
        totalIncome: 10000,
        netSavings: 1000,
        savingsRate: 10,
        byCategory: [],
        topMerchants: [],
        dailyAverage: 300,
        monthlyAverage: 9000,
        comparisonToPrevious: { spentChange: 0, incomeChange: 0, savingsChange: 0 },
      } as any);

      const result = await service.getRecommendations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('RECOMMENDATION');
    });

    it('should warn about spending increase', async () => {
      jest.spyOn(service, 'getSpendingInsights').mockResolvedValue({
        period: InsightPeriod.MONTH,
        totalSpent: 10000,
        totalIncome: 20000,
        netSavings: 10000,
        savingsRate: 50,
        byCategory: [],
        topMerchants: [],
        dailyAverage: 333,
        monthlyAverage: 10000,
        comparisonToPrevious: { spentChange: 15, incomeChange: 0, savingsChange: 0 },
      } as any);

      const result = await service.getRecommendations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('TREND');
    });
  });

  describe('getPredictions', () => {
    it('should return AI service predictions when available', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            success: true,
            data: {
              nextMonthSpending: 10500,
              confidence: 0.8,
            },
          },
        }),
      );

      const result = await service.getPredictions('user-1');

      expect(result.nextMonthSpending).toBe(10500);
      expect(result.confidence).toBe(0.8);
    });

    it('should fallback to basic predictions when AI service fails', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Service unavailable')));
      jest.spyOn(service, 'getSpendingInsights').mockResolvedValue({
        period: InsightPeriod.MONTH,
        totalSpent: 10000,
        totalIncome: 20000,
        netSavings: 10000,
        savingsRate: 50,
        byCategory: [],
        topMerchants: [],
        dailyAverage: 333,
        monthlyAverage: 10000,
        comparisonToPrevious: { spentChange: 0, incomeChange: 0, savingsChange: 0 },
      } as any);

      const result = await service.getPredictions('user-1');

      expect(result.nextMonthSpending).toBe(10500); // 10000 * 1.05
      expect(result.confidence).toBe(0.6);
    });
  });

  describe('getAnomalies', () => {
    it('should detect unusually high transactions', async () => {
      const transactions = [
        mockTransaction({ amount: 100 }),
        mockTransaction({ amount: 120 }),
        mockTransaction({ amount: 110 }),
        mockTransaction({ amount: 105 }),
        mockTransaction({ amount: 115 }),
        mockTransaction({ amount: 5000, merchant: 'Luxury Store' }),
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.getAnomalies('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('UNUSUAL_SPENDING');
      expect(result[0].severity).toBe('HIGH');
      expect(result[0].amount).toBe(5000);
    });

    it('should return empty array for insufficient transactions', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        mockTransaction({ amount: 100 }),
        mockTransaction({ amount: 120 }),
      ]);

      const result = await service.getAnomalies('user-1');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no anomalies found', async () => {
      const transactions = [
        mockTransaction({ amount: 100 }),
        mockTransaction({ amount: 120 }),
        mockTransaction({ amount: 110 }),
        mockTransaction({ amount: 105 }),
        mockTransaction({ amount: 115 }),
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      const result = await service.getAnomalies('user-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAllInsights', () => {
    it('should return all insights combined', async () => {
      const spendingInsights = {
        period: InsightPeriod.MONTH,
        totalSpent: 10000,
        totalIncome: 20000,
        netSavings: 10000,
        savingsRate: 50,
        byCategory: [],
        topMerchants: [],
        dailyAverage: 333,
        monthlyAverage: 10000,
        comparisonToPrevious: { spentChange: 0, incomeChange: 0, savingsChange: 0 },
      };

      jest.spyOn(service, 'getSpendingInsights').mockResolvedValue(spendingInsights as any);
      jest.spyOn(service, 'getRecommendations').mockResolvedValue([]);
      jest.spyOn(service, 'getPredictions').mockResolvedValue({
        nextMonthSpending: 10500,
        confidence: 0.6,
      });
      jest.spyOn(service, 'getAnomalies').mockResolvedValue([]);

      const result = await service.getAllInsights('user-1');

      expect(result.spending).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.predictions).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });
});
