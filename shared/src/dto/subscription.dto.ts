import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum SubscriptionFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export class CreateSubscriptionDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  name!: string;

  @IsNumber()
  amount!: number;

  @IsEnum(SubscriptionFrequency)
  frequency!: SubscriptionFrequency;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  nextBillingDate?: Date | string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(SubscriptionFrequency) frequency?: SubscriptionFrequency;
  @IsOptional() @IsString() merchantName?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsDateString() nextBillingDate?: Date | string;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @IsOptional() @IsString() notes?: string;
}

export class DetectedSubscriptionDto {
  merchant!: string;
  amount!: number;
  frequency!: SubscriptionFrequency | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  confidence!: number;
  transactionIds?: string[];
  firstTransactionDate?: Date;
  lastTransactionDate?: Date;
}
