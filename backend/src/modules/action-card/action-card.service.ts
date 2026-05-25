import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateActionCardDto,
  UpdateActionCardDto,
  BulkSyncCardsDto,
  CardStatus,
  CardPriority,
} from './dto';

@Injectable()
export class ActionCardService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateActionCardDto) {
    return this.prisma.actionCard.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? CardPriority.MEDIUM,
        impactAmount: dto.impactAmount ?? null,
        impactType: dto.impactType ?? null,
        actionData: dto.actionData ?? {},
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async findAll(
    userId: string,
    filters: { status?: string; priority?: string } = {},
  ) {
    const where: any = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    // Filter out expired (PENDING) cards in the query, but keep completed/dismissed history
    const now = new Date();

    const cards = await this.prisma.actionCard.findMany({
      where: {
        ...where,
        OR: [
          { status: { in: ['COMPLETED', 'DISMISSED'] } },
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return cards.map((c) => ({
      ...c,
      impactAmount: c.impactAmount ? Number(c.impactAmount) : null,
    }));
  }

  async findOne(userId: string, id: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, userId },
    });

    if (!card) {
      throw new NotFoundException('Action card not found');
    }

    return {
      ...card,
      impactAmount: card.impactAmount ? Number(card.impactAmount) : null,
    };
  }

  async update(userId: string, id: string, dto: UpdateActionCardDto) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, userId },
    });

    if (!card) {
      throw new NotFoundException('Action card not found');
    }

    const data: any = { ...dto };
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);

    return this.prisma.actionCard.update({ where: { id }, data });
  }

  async dismiss(userId: string, id: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, userId },
    });

    if (!card) {
      throw new NotFoundException('Action card not found');
    }

    return this.prisma.actionCard.update({
      where: { id },
      data: { status: CardStatus.DISMISSED, dismissedAt: new Date() },
    });
  }

  async complete(userId: string, id: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, userId },
    });

    if (!card) {
      throw new NotFoundException('Action card not found');
    }

    return this.prisma.actionCard.update({
      where: { id },
      data: { status: CardStatus.COMPLETED, completedAt: new Date() },
    });
  }

  async delete(userId: string, id: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, userId },
    });

    if (!card) {
      throw new NotFoundException('Action card not found');
    }

    await this.prisma.actionCard.delete({ where: { id } });
    return { message: 'Action card deleted' };
  }

  /**
   * Replace all PENDING cards with a fresh batch from the AI service.
   * Keeps any user-acted cards (COMPLETED/DISMISSED/IN_PROGRESS).
   */
  async bulkSync(userId: string, dto: BulkSyncCardsDto) {
    const replacePending = dto.replacePending !== false;

    if (replacePending) {
      await this.prisma.actionCard.deleteMany({
        where: { userId, status: CardStatus.PENDING },
      });
    }

    const created = await Promise.all(
      dto.cards.map((card) =>
        this.prisma.actionCard.create({
          data: {
            userId,
            type: card.type,
            title: card.title,
            description: card.description,
            priority: card.priority ?? CardPriority.MEDIUM,
            impactAmount: card.impactAmount ?? null,
            impactType: card.impactType ?? null,
            actionData: card.actionData ?? {},
            expiresAt: card.expiresAt ? new Date(card.expiresAt) : null,
          },
        }),
      ),
    );

    return {
      created: created.length,
      replacedPending: replacePending,
      cards: created,
    };
  }
}
