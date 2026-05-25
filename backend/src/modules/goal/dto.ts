import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ example: 'Emergency Fund' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @Min(0)
  targetAmount!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ example: 'emergency' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '🛡️' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#10B981' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoAllocate?: boolean;

  @ApiPropertyOptional({ example: 0.1, description: 'Fraction of income to allocate (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  allocationPercent?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}

export class ContributeGoalDto {
  @ApiProperty({ example: 1000, description: 'Amount to add to the goal' })
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
