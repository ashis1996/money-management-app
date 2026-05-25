import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum AccountTypeEnum {
  BANK = 'BANK',
  WALLET = 'WALLET',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT',
  LOAN = 'LOAN',
}

export class CreateAccountDto {
  @ApiProperty({ enum: AccountTypeEnum })
  @IsEnum(AccountTypeEnum)
  accountType!: AccountTypeEnum;

  @ApiProperty({ example: 'Salary Account' })
  @IsString()
  @MinLength(1)
  accountName!: string;

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ example: '****4521', description: 'Last 4 digits' })
  @IsOptional()
  @IsString()
  maskedAccountNumber?: string;

  @ApiPropertyOptional({ example: 'HDFC0001234' })
  @IsOptional()
  @IsString()
  ifscCode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  balance?: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '#004C8F' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '🏦' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
