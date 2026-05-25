import { IsString, IsOptional, IsDateString } from 'class-validator';
import { TransactionType } from './transaction.dto';

export class SmsIngestDto {
  @IsString()
  userId: string;

  @IsString()
  body: string;

  @IsString()
  sender: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: Date;
}

export class ParsedSmsDto {
  amount: number;
  transactionType: TransactionType;
  category?: string;
  merchant?: string;
  timestamp: Date;
  isSubscription: boolean;
  rawText: string;
}

export class SmsParseResponseDto {
  success: boolean;
  data?: ParsedSmsDto;
  error?: string;
}
