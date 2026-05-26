import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Logger } from '../../common/utils/logger';
import { firstValueFrom } from 'rxjs';
import { InsightPeriod } from '@money-management/shared/dto';

export interface CategoryBreakdown {
  categoryId: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageTransaction: number;
  changeFromPrevious: number;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async getSpendingInsights(userId: string, period: InsightPeriod = InsightPeriod.MONTH) {
    const now = new Date();
    const { startDate, previousStartDate } = this.getDateRange(period, now);

    const currentTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: startDate, lte: now },
      },
    });

    const previousTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: previousStartDate, lt: startDate },
      },
    });

    const currentIncome = currentTransactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const currentExpense = currentTransactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const previousIncome = previousTransactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const previousExpense = previousTransactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const categoryBreakdown = await this.getCategoryBreakdown(userId, startDate, now);
    const topMerchants = await this.getTopMerchants(userId, startDate, now);

    const daysInPeriod = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const dailyAverage = currentExpense / Math.max(daysInPeriod, 1);

    return {
      period,
      totalSpent: currentExpense,
      totalIncome: currentIncome,
      netSavings: currentIncome - currentExpense,
      savingsRate: currentIncome > 0 ? ((currentIncome - currentExpense) / currentIncome) * 100 : 0,
      byCategory: categoryBreakdown,
      topMerchants,
      dailyAverage,
      monthlyAverage: currentExpense,
      comparisonToPrevious: {
        spentChange:
          previousExpense > 0 ? ((currentExpense - previousExpense) / previousExpense) * 100 : 0,
        incomeChange:
          previousIncome > 0 ? ((currentIncome - previousIncome) / previousIncome) * 100 : 0,
        savingsChange:
          previousIncome - previousExpense !== 0
            ? ((currentIncome -
                currentExpense -
                (previousIncome - previousExpense)) /
                (previousIncome - previousExpense)) *
              100
            : 0,
      },
    };
  }

  private async getCategoryBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CategoryBreakdown[]> {
    const breakdown = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'DEBIT',
        deletedAt: null,
        transactionDate: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const total = breakdown.reduce((sum, cat) => sum + Number(cat._sum.amount || 0), 0);

    return breakdown.map((cat) => ({
      categoryId: cat.categoryId || 'Uncategorized',
      amount: Number(cat._sum.amount || 0),
      percentage: total > 0 ? (Number(cat._sum.amount || 0) / total) * 100 : 0,
      transactionCount: cat._count.id,
      averageTransaction: Number(cat._sum.amount || 0) / cat._count.id,
      changeFromPrevious: 0,
    }));
  }

  private async getTopMerchants(userId: string, startDate: Date, endDate: Date, limit: number = 5) {
    const breakdown = await this.prisma.transaction.groupBy({
      by: ['merchantName'],
      where: {
        userId,
        type: 'DEBIT',
        deletedAt: null,
        merchantName: { not: null },
        transactionDate: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return breakdown
      .sort((a, b) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0))
      .slice(0, limit)
      .map((m) => ({
        merchantName: m.merchantName || 'Unknown',
        amount: Number(m._sum.amount || 0),
        transactionCount: m._count.id,
      }));
  }

  private getDateRange(period: InsightPeriod, now: Date): { startDate: Date; previousStartDate: Date } {
    const startDate = new Date(now);
    const previousStartDate = new Date(now);

    switch (period) {
      case InsightPeriod.WEEK:
        startDate.setDate(now.getDate() - 7);
        previousStartDate.setDate(now.getDate() - 14);
        break;
      case InsightPeriod.MONTH:
        startDate.setMonth(now.getMonth() - 1);
        previousStartDate.setMonth(now.getMonth() - 2);
        break;
      case InsightPeriod.QUARTER:
        startDate.setMonth(now.getMonth() - 3);
        previousStartDate.setMonth(now.getMonth() - 6);
        break;
      case InsightPeriod.YEAR:
        startDate.setFullYear(now.getFullYear() - 1);
        previousStartDate.setFullYear(now.getFullYear() - 2);
        break;
    }

    return { startDate, previousStartDate };
  }

  async getRecommendations(userId: string) {
    const insights = await this.getSpendingInsights(userId, InsightPeriod.MONTH);

    const recommendations: any[] = [];

    const highSpendCategories = insights.byCategory.filter((c) => c.percentage > 25);
    if (highSpendCategories.length > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-1`,
        type: 'SPENDING_ANALYSIS',
        title: 'Review High Spending Categories',
        description: `You're spending more than 25% on ${highSpendCategories
          .map((c) => c.categoryId)
          .join(', ')}. Consider setting budgets for these categories.`,
        priority: 'HIGH' as const,
        potentialSavings: insights.totalSpent * 0.1,
      });
    }

    if (insights.savingsRate < 20) {
      recommendations.push({
        id: `rec-${Date.now()}-2`,
        type: 'RECOMMENDATION',
        title: 'Improve Savings Rate',
        description: `Your current savings rate is ${insights.savingsRate.toFixed(1)}%. Aim for at least 20% of income.`,
        priority: 'MEDIUM' as const,
        action: 'Set up automatic transfers to savings',
      });
    }

    if (insights.comparisonToPrevious.spentChange > 10) {
      recommendations.push({
        id: `rec-${Date.now()}-3`,
        type: 'TREND',
        title: 'Spending Increased',
        description: `Your spending increased by ${insights.comparisonToPrevious.spentChange.toFixed(1)}% compared to last period.`,
        priority: 'MEDIUM' as const,
      });
    }

    return recommendations;
  }

  async getPredictions(userId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/v1/predict`, {
          userId,
          period: 'next_month',
        }),
      );

      if (response.data && response.data.success) {
        return response.data.data;
      }
    } catch (error: any) {
      this.logger.warn(`AI service unavailable, using basic predictions: ${error.message}`);
    }

    const insights = await this.getSpendingInsights(userId, InsightPeriod.MONTH);

    return {
      nextMonthSpending: insights.totalSpent * 1.05,
      confidence: 0.6,
      categoryPredictions: insights.byCategory.map((cat) => ({
        category: cat.categoryId,
        predictedAmount: cat.amount * 1.05,
        confidence: 0.5,
      })),
      upcomingLargeExpenses: [],
      savingsProjection: {
        threeMonth: insights.netSavings * 3,
        sixMonth: insights.netSavings * 6,
        oneYear: insights.netSavings * 12,
      },
    };
  }

  async getAnomalies(userId: string) {
    const anomalies: any[] = [];
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'DEBIT',
        deletedAt: null,
        transactionDate: { gte: startDate },
      },
    });

    if (transactions.length < 5) return anomalies;

    const amounts = transactions.map((t) => Number(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avg, 2), 0) / amounts.length,
    );

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (amount > avg + 2 * stdDev) {
        anomalies.push({
          type: 'UNUSUAL_SPENDING' as const,
          severity: 'HIGH' as const,
          description: `Unusually high transaction of ₹${amount} at ${t.merchantName || 'Unknown merchant'}`,
          amount,
          transactionId: t.id,
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  async getAllInsights(userId: string) {
    const [spending, recommendations, predictions, anomalies] = await Promise.all([
      this.getSpendingInsights(userId, InsightPeriod.MONTH),
      this.getRecommendations(userId),
      this.getPredictions(userId),
      this.getAnomalies(userId),
    ]);

    return {
      spending,
      trends: [],
      anomalies,
      recommendations,
      predictions,
      generatedAt: new Date(),
    };
  }
}
