import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { HashUtils } from '../../common/utils/hash';
import { CreateUserDto, UserResponseDto } from '@shared/dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if phone already exists
    if (createUserDto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: createUserDto.phone },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    // Hash password
    const passwordHash = await HashUtils.hashPassword(createUserDto.password);

    // Create user
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
        name: 'Main Account',
        type: 'BANK',
        balance: 0,
      },
    });

    return user;
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

    return user;
  }

  async findByEmail(email: string): Promise<UserResponseDto & { passwordHash: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return user;
  }

  async update(id: string, updateData: Partial<CreateUserDto>): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing email
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    // Hash password if changing
    const updatePayload: any = { ...updateData };
    if (updateData.password) {
      updatePayload.passwordHash = await HashUtils.hashPassword(updateData.password);
      delete updatePayload.password;
    }

    return this.prisma.user.update({
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
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(id: string): Promise<UserResponseDto> {
    return this.prisma.user.update({
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
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async getDashboardStats(userId: string): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get account balances
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { balance: true, accountType: true },
    });

    // Get monthly transactions
    const monthlyTransactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        transactionDate: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Get subscription count
    const subscriptionCount = await this.prisma.subscription.count({
      where: { userId, status: 'ACTIVE' },
    });

    // Get unread notifications
    const unreadNotifications = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

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
