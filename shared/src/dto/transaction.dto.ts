import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';

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
  @IsOptional() @IsNumber() minAmount?: number;
  @IsOptional() @IsNumber() maxAmount?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() limit?: number;
  @IsOptional() offset?: number;
}
