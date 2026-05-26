import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { TransactionType } from './transaction.dto';

export class SmsIngestDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  body!: string;

  @IsString()
  sender!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: Date | string;

  @IsOptional()
  @IsDateString()
  receivedAt?: Date | string;
}

export class ParsedSmsDto {
  amount?: number;
  transactionType?: TransactionType;
  category?: string;
  merchant?: string;
  timestamp!: Date;
  isSubscription?: boolean;
  rawText?: string;
  rawSms?: string;
  sender?: string;
  confidence?: number;
  balance?: number;
  accountLast4?: string;
}

export class SmsParseResponseDto {
  success!: boolean;
  parsed?: ParsedSmsDto;
  data?: ParsedSmsDto;
  error?: string;
  transactionCreated?: boolean;
  transactionId?: string;
}
