import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { CreateTransactionDto, UpdateTransactionDto, TransactionsFilterDto } from '@shared/dto';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private rabbitMQ: RabbitMQService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        amount: dto.amount,
        type: dto.type,
        categoryId: dto.category,
        description: dto.description,
        merchantName: dto.merchant,
        transactionDate: new Date(dto.date),
        rawSmsText: dto.rawSms,
        isSubscription: !!dto.subscriptionId,
        subscriptionId: dto.subscriptionId,
      },
    });

    // Publish event for async processing
    await this.rabbitMQ.publishTransactionCreated({
      transactionId: transaction.id,
      userId,
      amount: Number(transaction.amount),
      category: transaction.category || 'UNKNOWN',
    });

    return transaction;
  }

  async findAll(userId: string, filters: TransactionsFilterDto) {
    const { from, to, category, minAmount, maxAmount, search } = filters;

    const where: any = { userId };

    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(from);
      if (to) where.transactionDate.lte = new Date(to);
    }

    if (category) {
      where.categoryId = category;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { merchantName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      include: {
        account: { select: { accountName: true, accountType: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        subscription: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: dto,
    });
  }

  async delete(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.transaction.delete({
      where: { id },
    });

    return { message: 'Transaction deleted successfully' };
  }

  async getCategories(userId: string, from?: Date, to?: Date) {
    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'DEBIT',
        transactionDate: {
          gte: from,
          lte: to || new Date(),
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    return transactions.map((cat) => ({
      categoryId: cat.categoryId || 'Uncategorized',
      totalAmount: Number(cat._sum.amount || 0),
      transactionCount: cat._count.id,
    }));
  }

  async getMonthlyStats(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const income = transactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      year,
      month,
      income,
      expense,
      netSavings: income - expense,
      transactionCount: transactions.length,
    };
  }

  async search(userId: string, query: string, limit: number = 10) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { merchantName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { transactionDate: 'desc' },
    });
  }
}
