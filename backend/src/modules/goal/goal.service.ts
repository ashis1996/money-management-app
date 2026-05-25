import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto } from './dto';

@Injectable()
export class GoalService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        currency: dto.currency ?? 'INR',
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        category: dto.category ?? null,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        autoAllocate: dto.autoAllocate ?? false,
        allocationPercent: dto.allocationPercent ?? null,
        priority: dto.priority ?? 0,
      },
    });

    return this.serialize(goal);
  }

  async findAll(userId: string, includeCompleted = true) {
    const where: any = { userId, deletedAt: null };
    if (!includeCompleted) {
      where.isCompleted = false;
    }

    const goals = await this.prisma.goal.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return goals.map((g) => this.serialize(g));
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return this.serialize(goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const data: any = { ...dto };
    if (dto.targetDate) data.targetDate = new Date(dto.targetDate);

    const updated = await this.prisma.goal.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async delete(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    // Soft delete
    await this.prisma.goal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Goal deleted successfully' };
  }

  async contribute(userId: string, id: string, dto: ContributeGoalDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.isCompleted) {
      throw new BadRequestException('Goal is already completed');
    }

    const newAmount = Number(goal.currentAmount) + dto.amount;
    const target = Number(goal.targetAmount);
    const isCompleted = newAmount >= target;

    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        currentAmount: Math.min(newAmount, target),
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    return this.serialize(updated);
  }

  async getSummary(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, deletedAt: null },
    });

    const active = goals.filter((g) => !g.isCompleted);
    const completed = goals.filter((g) => g.isCompleted);

    const totalTarget = active.reduce((s, g) => s + Number(g.targetAmount), 0);
    const totalSaved = active.reduce((s, g) => s + Number(g.currentAmount), 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalTarget,
      totalSaved,
      overallProgress: Math.round(overallProgress * 100) / 100,
      goals: goals.map((g) => this.serialize(g)),
    };
  }

  private serialize(goal: any) {
    const target = Number(goal.targetAmount);
    const current = Number(goal.currentAmount);
    const progress = target > 0 ? (current / target) * 100 : 0;
    let monthsToGoal: number | null = null;
    if (goal.targetDate) {
      const diff = new Date(goal.targetDate).getTime() - Date.now();
      monthsToGoal = Math.max(0, Math.ceil(diff / (30 * 24 * 3600 * 1000)));
    }

    return {
      ...goal,
      targetAmount: target,
      currentAmount: current,
      allocationPercent: goal.allocationPercent ? Number(goal.allocationPercent) : null,
      progress: Math.round(progress * 100) / 100,
      monthsToGoal,
    };
  }
}
