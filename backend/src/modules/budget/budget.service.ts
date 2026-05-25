import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateBudgetDto, UpdateBudgetDto, BudgetPeriodEnum } from './dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBudgetDto) {
    const period = dto.period ?? BudgetPeriodEnum.MONTHLY;
    const startDate = dto.startDate ? new Date(dto.startDate) : this.defaultStartDate(period);

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        name: dto.name,
        amountLimit: dto.amountLimit,
        amountSpent: 0,
        categoryId: dto.categoryId ?? null,
        currency: dto.currency ?? 'INR',
        period: period as any,
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        alertThreshold: dto.alertThreshold ?? 0.8,
        rollover: dto.rollover ?? false,
        notes: dto.notes ?? null,
      },
    });

    return this.computeSpentAndSerialize(userId, budget);
  }

  async findAll(userId: string, activeOnly = true) {
    const where: any = { userId, deletedAt: null };
    if (activeOnly) where.isActive = true;

    const budgets = await this.prisma.budget.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return Promise.all(budgets.map((b) => this.computeSpentAndSerialize(userId, b)));
  }

  async findOne(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return this.computeSpentAndSerialize(userId, budget);
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const updated = await this.prisma.budget.update({ where: { id }, data });
    return this.computeSpentAndSerialize(userId, updated);
  }

  async delete(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.prisma.budget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Budget deleted successfully' };
  }

  async getSummary(userId: string) {
    const budgets = await this.findAll(userId, true);

    const totalLimit = budgets.reduce((s, b) => s + b.amountLimit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.amountSpent, 0);
    const overBudget = budgets.filter((b) => b.amountSpent > b.amountLimit);
    const nearLimit = budgets.filter(
      (b) => b.amountSpent <= b.amountLimit && b.utilization >= b.alertThreshold * 100,
    );

    return {
      totalBudgets: budgets.length,
      totalLimit,
      totalSpent,
      remaining: totalLimit - totalSpent,
      overBudgetCount: overBudget.length,
      nearLimitCount: nearLimit.length,
      overBudget: overBudget.map((b) => ({ id: b.id, name: b.name, exceededBy: b.amountSpent - b.amountLimit })),
      budgets,
    };
  }

  /**
   * Compute amountSpent from transactions in the budget period and return
   * a serialized budget with utilization data.
   */
  private async computeSpentAndSerialize(userId: string, budget: any) {
    const start = budget.startDate;
    const end = budget.endDate ?? this.computePeriodEnd(start, budget.period);

    const where: any = {
      userId,
      type: 'DEBIT',
      transactionDate: { gte: start, lte: end },
      deletedAt: null,
    };
    if (budget.categoryId) where.categoryId = budget.categoryId;

    const agg = await this.prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    });

    const amountSpent = Number(agg._sum.amount ?? 0);
    const amountLimit = Number(budget.amountLimit);
    const utilization = amountLimit > 0 ? (amountSpent / amountLimit) * 100 : 0;

    // Persist updated amountSpent for fast reads
    if (Number(budget.amountSpent) !== amountSpent) {
      await this.prisma.budget.update({
        where: { id: budget.id },
        data: { amountSpent },
      });
    }

    const now = new Date();
    const totalDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000)),
    );
    const daysElapsed = Math.max(
      1,
      Math.ceil((now.getTime() - start.getTime()) / (24 * 3600 * 1000)),
    );
    const daysLeft = Math.max(0, totalDays - daysElapsed);
    const remaining = Math.max(0, amountLimit - amountSpent);
    const dailyAllowance = daysLeft > 0 ? remaining / daysLeft : 0;

    return {
      ...budget,
      amountLimit,
      amountSpent,
      alertThreshold: Number(budget.alertThreshold ?? 0.8),
      utilization: Math.round(utilization * 100) / 100,
      remaining,
      isOverBudget: amountSpent > amountLimit,
      daysLeft,
      dailyAllowance: Math.round(dailyAllowance),
    };
  }

  private defaultStartDate(period: BudgetPeriodEnum): Date {
    const now = new Date();
    if (period === BudgetPeriodEnum.WEEKLY) {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === BudgetPeriodEnum.YEARLY) {
      return new Date(now.getFullYear(), 0, 1);
    }
    // Monthly default
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private computePeriodEnd(start: Date, period: string): Date {
    const d = new Date(start);
    if (period === 'WEEKLY') d.setDate(d.getDate() + 7);
    else if (period === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    d.setMilliseconds(-1);
    return d;
  }
}
