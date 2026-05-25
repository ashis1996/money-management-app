import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsObject,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum CardPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum CardStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DISMISSED = 'DISMISSED',
}

export class CreateActionCardDto {
  @ApiProperty({ example: 'CANCEL_SUBSCRIPTION' })
  @IsString()
  @MinLength(1)
  type!: string;

  @ApiProperty({ example: 'Cancel Spotify' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: "You haven't used Spotify in 30 days." })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: CardPriority })
  @IsOptional()
  @IsEnum(CardPriority)
  priority?: CardPriority;

  @ApiPropertyOptional({ example: 119 })
  @IsOptional()
  @IsNumber()
  impactAmount?: number;

  @ApiPropertyOptional({ example: 'SAVINGS' })
  @IsOptional()
  @IsString()
  impactType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actionData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateActionCardDto extends PartialType(CreateActionCardDto) {}

export class BulkSyncCardsDto {
  @ApiProperty({ type: [CreateActionCardDto] })
  cards!: CreateActionCardDto[];

  @ApiPropertyOptional({ description: 'Replace all PENDING cards', default: true })
  @IsOptional()
  replacePending?: boolean;
}
