import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import {
  SmsIngestDto,
  SmsParseResponseDto,
  ParsedSmsDto,
  TransactionType,
} from '@shared/dto';
import { Logger } from '../../common/utils/logger';
import {
  TRANSACTION_KEYWORDS,
  CATEGORY_MAPPINGS,
  BANK_SENDER_MAPPING,
} from '@shared/constants';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private rabbitMQ: RabbitMQService,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async ingestSms(userId: string, dto: SmsIngestDto): Promise<SmsParseResponseDto> {
    const receivedAt = dto.timestamp ?? dto.receivedAt ?? new Date();
    const smsLog = await this.prisma.smsLog.create({
      data: {
        userId,
        body: dto.body,
        sender: dto.sender,
        phoneNumber: dto.phoneNumber,
        receivedAt: new Date(receivedAt as any),
        isProcessed: false,
      },
    });

    await this.rabbitMQ.publishSmsReceived({
      smsId: smsLog.id,
      body: dto.body,
      sender: dto.sender,
      timestamp: new Date(receivedAt as any),
    });

    const parsed = await this.parseSms(dto.body, dto.sender, new Date(receivedAt as any));

    await this.prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        isProcessed: true,
        parsedData: parsed as any,
      },
    });

    let transactionCreated = false;
    let transactionId: string | undefined;

    if (parsed.amount && parsed.transactionType) {
      try {
        const transaction = await this.prisma.transaction.create({
          data: {
            userId,
            amount: parsed.amount,
            type: parsed.transactionType as any,
            categoryId: parsed.category,
            merchantName: parsed.merchant,
            transactionDate: parsed.timestamp,
            rawSmsText: dto.body,
            smsSenderId: dto.sender,
            source: 'SMS',
          },
        });

        await this.prisma.smsLog.update({
          where: { id: smsLog.id },
          data: { transactionId: transaction.id },
        });

        transactionCreated = true;
        transactionId = transaction.id;

        await this.rabbitMQ.publishTransactionCreated({
          transactionId: transaction.id,
          userId,
          amount: parsed.amount,
          category: parsed.category || 'UNKNOWN',
        });
      } catch (error: any) {
        this.logger.error(`Failed to create transaction from SMS: ${error.message}`);
      }
    }

    return {
      success: true,
      parsed,
      transactionCreated,
      transactionId,
    };
  }

  async parseSms(body: string, sender: string, timestamp: Date): Promise<ParsedSmsDto> {
    const parsed: ParsedSmsDto = {
      rawSms: body,
      sender,
      timestamp,
      confidence: 0,
    };

    const bank = this.identifyBank(sender);
    if (bank) this.logger.debug(`Identified bank: ${bank}`);

    // Extract amount
    const amountMatch =
      body.match(/(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)/i) ||
      body.match(/(?:debited|credited)[^\d]*([\d,]+\.?\d*)/i);

    if (amountMatch) {
      const amountStr = amountMatch[1] || amountMatch[0];
      parsed.amount = parseFloat(amountStr.replace(/,/g, ''));
      parsed.confidence = (parsed.confidence ?? 0) + 0.3;
    }

    // Determine transaction type
    const lowerBody = body.toLowerCase();
    if (TRANSACTION_KEYWORDS.CREDIT.some((kw: string) => lowerBody.includes(kw))) {
      parsed.transactionType = TransactionType.CREDIT;
      parsed.confidence = (parsed.confidence ?? 0) + 0.2;
    } else if (TRANSACTION_KEYWORDS.DEBIT.some((kw: string) => lowerBody.includes(kw))) {
      parsed.transactionType = TransactionType.DEBIT;
      parsed.confidence = (parsed.confidence ?? 0) + 0.2;
    }

    // Extract merchant
    const merchantMatch = body.match(/(?:at|to|from)\s+([A-Za-z0-9\s&.,-]+)/i);
    if (merchantMatch) {
      parsed.merchant = merchantMatch[1].trim();
      parsed.confidence = (parsed.confidence ?? 0) + 0.1;
    }

    parsed.category = this.categorizeTransaction(body, parsed.merchant);

    const balanceMatch = body.match(/(?:balance|avail)[^\d]*([\d,]+\.?\d*)/i);
    if (balanceMatch) {
      parsed.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      parsed.confidence = (parsed.confidence ?? 0) + 0.1;
    }

    const accountMatch = body.match(/(?:ending|card)[^\d]*(\d{4})/i);
    if (accountMatch) {
      parsed.accountLast4 = accountMatch[1];
      parsed.confidence = (parsed.confidence ?? 0) + 0.1;
    }

    if (parsed.amount && parsed.transactionType) {
      parsed.confidence = Math.min((parsed.confidence ?? 0) + 0.2, 1.0);
    }

    return parsed;
  }

  private identifyBank(sender: string): string | null {
    const normalizedSender = sender.toUpperCase().trim();
    return BANK_SENDER_MAPPING[normalizedSender] || null;
  }

  private categorizeTransaction(body: string, merchant?: string): string {
    const lowerBody = body.toLowerCase();
    const lowerMerchant = merchant?.toLowerCase() || '';

    for (const [category, keywords] of Object.entries(CATEGORY_MAPPINGS)) {
      const kwArr = keywords as string[];
      if (kwArr.some((kw: string) => lowerBody.includes(kw) || lowerMerchant.includes(kw))) {
        return category;
      }
    }

    if (TRANSACTION_KEYWORDS.ATM?.some((kw: string) => lowerBody.includes(kw))) return 'ATM';
    if (TRANSACTION_KEYWORDS.SUBSCRIPTION?.some((kw: string) => lowerBody.includes(kw)))
      return 'SUBSCRIPTION';
    if (TRANSACTION_KEYWORDS.TRANSFER?.some((kw: string) => lowerBody.includes(kw)))
      return 'TRANSFER';

    return 'OTHER';
  }

  async getUnprocessedSms(userId: string, limit: number = 100) {
    return this.prisma.smsLog.findMany({
      where: { userId, isProcessed: false },
      take: limit,
      orderBy: { receivedAt: 'desc' },
    });
  }

  async getSmsHistory(userId: string, page: number = 1, limit: number = 20) {
    const [total, smsLogs] = await Promise.all([
      this.prisma.smsLog.count({ where: { userId } }),
      this.prisma.smsLog.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    return {
      data: smsLogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
