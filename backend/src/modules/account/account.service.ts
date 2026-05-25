import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto) {
    // If marked as primary, unset other primary accounts
    if (dto.isPrimary) {
      await this.prisma.account.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    try {
      const account = await this.prisma.account.create({
        data: {
          userId,
          accountType: dto.accountType as any,
          accountName: dto.accountName,
          providerName: dto.providerName ?? null,
          maskedAccountNumber: dto.maskedAccountNumber ?? null,
          ifscCode: dto.ifscCode ?? null,
          balance: dto.balance ?? 0,
          currency: dto.currency ?? 'INR',
          color: dto.color ?? null,
          icon: dto.icon ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });
      return this.serialize(account);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('An account with that name already exists');
      }
      throw e;
    }
  }

  async findAll(userId: string, type?: string) {
    const where: any = { userId, deletedAt: null, isActive: true };
    if (type) where.accountType = type;

    const accounts = await this.prisma.account.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { accountType: 'asc' }, { createdAt: 'asc' }],
    });

    return accounts.map((a) => this.serialize(a));
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return this.serialize(account);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (dto.isPrimary) {
      await this.prisma.account.updateMany({
        where: { userId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: dto as any,
    });

    return this.serialize(updated);
  }

  async delete(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { message: 'Account removed successfully' };
  }

  async setPrimary(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.prisma.account.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });

    const updated = await this.prisma.account.update({
      where: { id },
      data: { isPrimary: true },
    });

    return this.serialize(updated);
  }

  /**
   * Recompute account balance from transactions. Useful for sync action.
   */
  async sync(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const txAgg = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, accountId: id, deletedAt: null },
      _sum: { amount: true },
    });

    let credits = 0;
    let debits = 0;
    for (const row of txAgg) {
      const sum = Number(row._sum.amount ?? 0);
      if (row.type === 'CREDIT') credits = sum;
      else if (row.type === 'DEBIT') debits = sum;
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return {
      ...this.serialize(updated),
      syncStats: {
        credits,
        debits,
        netFlow: credits - debits,
        lastSyncedAt: updated.updatedAt,
      },
    };
  }

  /**
   * Net worth: assets (positive balances of non-loan accounts) minus liabilities
   * (credit-card utilization + loan remaining).
   */
  async getNetWorth(userId: string) {
    const accounts = await this.findAll(userId);

    const assets = accounts
      .filter((a) => a.balance > 0 && a.accountType !== 'LOAN')
      .reduce((s, a) => s + a.balance, 0);

    const liabilities = accounts
      .filter((a) => a.balance < 0 || a.accountType === 'LOAN')
      .reduce((s, a) => s + Math.abs(a.balance), 0);

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
      breakdown: {
        bank: accounts.filter((a) => a.accountType === 'BANK').reduce((s, a) => s + a.balance, 0),
        wallet: accounts.filter((a) => a.accountType === 'WALLET').reduce((s, a) => s + a.balance, 0),
        creditCard: accounts.filter((a) => a.accountType === 'CREDIT_CARD').reduce((s, a) => s + a.balance, 0),
        investment: accounts.filter((a) => a.accountType === 'INVESTMENT').reduce((s, a) => s + a.balance, 0),
        loan: accounts.filter((a) => a.accountType === 'LOAN').reduce((s, a) => s + a.balance, 0),
      },
      accountCount: accounts.length,
    };
  }

  private serialize(account: any) {
    return {
      ...account,
      balance: Number(account.balance),
    };
  }
}
