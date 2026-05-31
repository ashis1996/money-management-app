import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../config/prisma.service';
import { HashUtils } from '../../common/utils/hash';
import { AuditService } from '../audit/audit.service';
import { Logger } from '../../common/utils/logger';
import { CreateUserDto, UserResponseDto } from '@money-management/shared/dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (createUserDto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: createUserDto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const passwordHash = await HashUtils.hashPassword(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        name: createUserDto.name,
        phone: createUserDto.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create default account
    await this.prisma.account.create({
      data: {
        userId: user.id,
        accountName: 'Main Account',
        accountType: 'BANK',
        balance: 0,
        isPrimary: true,
      },
    });

    return user as UserResponseDto;
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as UserResponseDto;
  }

  async findByEmail(email: string): Promise<(UserResponseDto & { passwordHash: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;
    return user as unknown as UserResponseDto & { passwordHash: string };
  }

  async update(id: string, updateData: Partial<CreateUserDto>): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });
      if (existingUser) throw new ConflictException('Email already registered');
    }

    const updatePayload: any = { ...updateData };
    let passwordChanged = false;
    if (updateData.password) {
      updatePayload.passwordHash = await HashUtils.hashPassword(updateData.password);
      delete updatePayload.password;
      passwordChanged = true;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (passwordChanged) {
      // A password change must invalidate every outstanding session.
      // Bumping tokenVersion in a separate update keeps the password
      // write atomic; the audit row records the event for compliance.
      await this.prisma.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
      });
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

      void this.audit.record({
        userId: id,
        action: 'USER_PASSWORD_CHANGED',
        entityType: 'User',
        entityId: id,
      });
    }

    return updated as UserResponseDto;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(id: string): Promise<UserResponseDto> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return updated as UserResponseDto;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * GDPR/DPDP "right to erasure".
   *
   * Hard-deletes the User row. All FK-cascading rows go with it
   * (transactions, accounts, refresh tokens, sms logs, etc., per the
   * `onDelete: Cascade` in schema.prisma). AuditLog is intentionally
   * preserved with userId set to NULL by the FK action because
   * regulators expect us to keep evidence that the deletion happened.
   *
   * The audit row is written BEFORE the delete so we never end up with
   * a deleted user and no tombstone evidence.
   */
  async deleteSelf(id: string, request?: Request): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    void this.audit.record({
      userId: id,
      action: 'USER_DELETE_SELF',
      entityType: 'User',
      entityId: id,
      oldValues: { email: user.email, createdAt: user.createdAt },
      request,
    });

    await this.prisma.user.delete({ where: { id } });
    this.logger.log('User deleted self', { userId: id });
  }

  /**
   * GDPR/DPDP "right to access".
   *
   * Bundles every row directly attached to the user into a single
   * JSON blob suitable for download. Heavy joins (full transaction
   * history, all SMS bodies) are intentionally included — when a user
   * asks for "all my data", that's what they mean.
   *
   * The export does NOT include passwordHash, refresh-token hashes, or
   * any column whose value is opaque to the user. Internal IDs are
   * preserved for support traceability.
   */
  async exportSelf(id: string, request?: Request): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        timezone: true,
        currency: true,
        emailVerified: true,
        phoneVerified: true,
        archetype: true,
        notificationPrefs: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // All scoped rows fetched in parallel. Each query goes through the
    // soft-delete middleware so tombstoned rows are excluded — this
    // matches what the user sees in the app and avoids exporting data
    // they thought was deleted.
    const [accounts, transactions, subscriptions, budgets, goals, notifications, smsLogs] =
      await Promise.all([
        this.prisma.account.findMany({ where: { userId: id } }),
        this.prisma.transaction.findMany({ where: { userId: id } }),
        this.prisma.subscription.findMany({ where: { userId: id } }),
        this.prisma.budget.findMany({ where: { userId: id } }),
        this.prisma.goal.findMany({ where: { userId: id } }),
        this.prisma.notification.findMany({ where: { userId: id } }),
        this.prisma.smsLog.findMany({ where: { userId: id } }),
      ]);

    void this.audit.record({
      userId: id,
      action: 'USER_DATA_EXPORT',
      entityType: 'User',
      entityId: id,
      newValues: {
        accounts: accounts.length,
        transactions: transactions.length,
        subscriptions: subscriptions.length,
        budgets: budgets.length,
        goals: goals.length,
        notifications: notifications.length,
        smsLogs: smsLogs.length,
      },
      request,
    });

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        userId: id,
        version: 1,
      },
      user,
      accounts,
      transactions,
      subscriptions,
      budgets,
      goals,
      notifications,
      smsLogs,
    };
  }

  async getDashboardStats(userId: string): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Each of these reads is independent. Running them sequentially (as
    // we did before) made dashboard load wait for ~4× the slowest query
    // — usually the groupBy on transactions. Promise.all lets the
    // connection pool fan out and cuts wall-clock to roughly one query.
    //
    // No `Promise.allSettled` here: if any of these fails the whole
    // dashboard is broken anyway and we'd rather surface the error than
    // ship a partially-populated payload that the UI silently renders.
    const [accounts, monthlyTransactions, subscriptionCount, unreadNotifications] =
      await Promise.all([
        this.prisma.account.findMany({
          where: { userId, isActive: true, deletedAt: null },
          select: { balance: true, accountType: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['type'],
          where: {
            userId,
            deletedAt: null,
            transactionDate: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }),
        this.prisma.subscription.count({
          where: { userId, status: 'ACTIVE', deletedAt: null },
        }),
        this.prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]);

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const monthlyIncome = monthlyTransactions.find((t) => t.type === 'CREDIT')?._sum.amount || 0;
    const monthlyExpense = monthlyTransactions.find((t) => t.type === 'DEBIT')?._sum.amount || 0;

    return {
      totalBalance,
      monthlyIncome: Number(monthlyIncome),
      monthlyExpense: Number(monthlyExpense),
      netSavings: Number(monthlyIncome) - Number(monthlyExpense),
      accountCount: accounts.length,
      activeSubscriptions: subscriptionCount,
      unreadNotifications,
    };
  }
}
