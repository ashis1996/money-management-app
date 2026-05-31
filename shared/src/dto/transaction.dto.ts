import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum TransactionSource {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  UPI = 'UPI',
  BANK_API = 'BANK_API',
  MANUAL = 'MANUAL',
  VOICE = 'VOICE',
  IMPORT = 'IMPORT',
}

export class CreateTransactionDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsNumber()
  amount!: number;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Convenience alias used by older code paths
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: Date | string;

  @IsOptional()
  @IsDateString()
  date?: Date | string;

  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @IsOptional()
  @IsString()
  rawSms?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;
}

export class UpdateTransactionDto {
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() merchantName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() transactionDate?: Date | string;
  @IsOptional() @IsBoolean() isUserConfirmed?: boolean;
}

export class TransactionsFilterDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsDateString() startDate?: Date | string;
  @IsOptional() @IsDateString() endDate?: Date | string;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() search?: string;
  // Pagination. We deliberately don't @IsNumber-validate page/limit here:
  // query strings need explicit transformation to coerce "20" → 20 and the
  // global ValidationPipe + class-transformer reflect-metadata interplay
  // is brittle for optional union types. The service is the source of
  // truth — it parses, clamps to [1, 100] for limit and >= 1 for page,
  // and falls back to defaults on garbage.
  @IsOptional() page?: any;
  @IsOptional() limit?: any;
  @IsOptional() offset?: any;
  @IsOptional() @Type(() => Number) @IsNumber() minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxAmount?: number;
}
