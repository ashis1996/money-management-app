import { IsString, IsOptional, IsDateString, IsNumber, IsIn } from 'class-validator';
import { TransactionType } from './transaction.dto';

/**
 * Where an ingested message came from. Drives parsing hints, source
 * labels on the resulting Transaction, and dedup behaviour against
 * SMS that may arrive in parallel for the same UPI payment.
 */
export const SMS_INGEST_SOURCES = ['SMS', 'UPI_NOTIFICATION', 'MANUAL'] as const;
export type SmsIngestSource = typeof SMS_INGEST_SOURCES[number];

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

  /**
   * Defaults to 'SMS'. UPI listener payloads send 'UPI_NOTIFICATION' so
   * the backend can label the resulting Transaction and apply UPI-aware
   * dedup against any concurrent bank SMS for the same payment.
   */
  @IsOptional()
  @IsIn(SMS_INGEST_SOURCES as unknown as string[])
  source?: SmsIngestSource;

  /**
   * Optional package name of the originating app for UPI notifications
   * (e.g. com.phonepe.app). Stored on SmsLog for forensics; ignored for
   * SMS-source ingests.
   */
  @IsOptional()
  @IsString()
  packageName?: string;
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
  /** Set to true by the backend when an existing transaction matched and
   * a new one was *not* created. */
  duplicate?: boolean;
}

export class SmsParseResponseDto {
  success!: boolean;
  parsed?: ParsedSmsDto;
  data?: ParsedSmsDto;
  error?: string;
  transactionCreated?: boolean;
  transactionId?: string;
}
