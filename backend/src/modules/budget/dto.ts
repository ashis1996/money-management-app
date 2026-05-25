import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum BudgetPeriodEnum {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreateBudgetDto {
  @ApiProperty({ example: 'Monthly Food' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  amountLimit!: number;

  @ApiPropertyOptional({ example: 'cat-food-uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: BudgetPeriodEnum, example: BudgetPeriodEnum.MONTHLY })
  @IsOptional()
  @IsEnum(BudgetPeriodEnum)
  period?: BudgetPeriodEnum;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 0.8, description: 'Alert threshold (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  alertThreshold?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
