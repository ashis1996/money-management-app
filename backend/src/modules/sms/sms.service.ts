import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { SmsIngestDto, SmsParseResponseDto, ParsedSmsDto } from '@shared/dto';
import { Logger } from '../../common/utils/logger';
import { SMS_PATTERNS, TRANSACTION_KEYWORDS, CATEGORY_MAPPINGS, BANK_SENDER_MAPPING } from '@shared/constants';

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
    // Save raw SMS
    const smsLog = await this.prisma.smsLog.create({
      data: {
        userId,
        body: dto.body,
        sender: dto.sender,
        phoneNumber: dto.phoneNumber,
        receivedAt: new Date(dto.timestamp),
        isProcessed: false,
      },
    });

    // Publish to queue for async processing
    await this.rabbitMQ.publishSmsReceived({
      smsId: smsLog.id,
      body: dto.body,
      sender: dto.sender,
      timestamp: new Date(dto.timestamp),
    });

    // Try to parse immediately for quick response
    const parsed = await this.parseSms(dto.body, dto.sender, new Date(dto.timestamp));

    // Update SMS log with parsed data
    await this.prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        isProcessed: true,
        parsedData: parsed as any,
      },
    });

    // Create transaction if SMS was parsed successfully
    let transactionCreated = false;
    let transactionId: string | undefined;

    if (parsed.amount && parsed.transactionType) {
      try {
        const transaction = await this.prisma.transaction.create({
          data: {
            userId,
            amount: parsed.amount,
            type: parsed.transactionType,
            categoryId: parsed.category,
            merchantName: parsed.merchant,
            transactionDate: parsed.timestamp,
            rawSmsText: dto.body,
            smsSenderId: dto.sender,
          },
        });

        await this.prisma.smsLog.update({
          where: { id: smsLog.id },
          data: { transactionId: transaction.id },
        });

        transactionCreated = true;
        transactionId = transaction.id;

        // Publish transaction event
        await this.rabbitMQ.publishTransactionCreated({
          transactionId: transaction.id,
          userId,
          amount: parsed.amount,
          category: parsed.category || 'UNKNOWN',
        });
      } catch (error) {
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

    // Identify bank from sender
    const bank = this.identifyBank(sender);
    if (bank) {
      this.logger.debug(`Identified bank: ${bank}`);
    }

    // Extract amount
    const amountMatch = body.match(/(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)/i) ||
                        body.match(/(?:debited|credited)[^\d]*([\d,]+\.?\d*)/i);

    if (amountMatch) {
      const amountStr = amountMatch[1] || amountMatch[0];
      parsed.amount = parseFloat(amountStr.replace(/,/g, ''));
      parsed.confidence += 0.3;
    }

    // Determine transaction type
    const lowerBody = body.toLowerCase();
    if (TRANSACTION_KEYWORDS.CREDIT.some((kw) => lowerBody.includes(kw))) {
      parsed.transactionType = 'CREDIT';
      parsed.confidence += 0.2;
    } else if (TRANSACTION_KEYWORDS.DEBIT.some((kw) => lowerBody.includes(kw))) {
      parsed.transactionType = 'DEBIT';
      parsed.confidence += 0.2;
    }

    // Extract merchant
    const merchantMatch = body.match(/(?:at|to|from)\s+([A-Za-z0-9\s&.,-]+)/i);
    if (merchantMatch) {
      parsed.merchant = merchantMatch[1].trim();
      parsed.confidence += 0.1;
    }

    // Categorize based on merchant and keywords
    parsed.category = this.categorizeTransaction(body, parsed.merchant);

    // Extract balance if available
    const balanceMatch = body.match(/(?:balance|avail)[^\d]*([\d,]+\.?\d*)/i);
    if (balanceMatch) {
      parsed.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      parsed.confidence += 0.1;
    }

    // Extract account last 4 digits
    const accountMatch = body.match(/(?:ending|card)[^\d]*(\d{4})/i);
    if (accountMatch) {
      parsed.accountLast4 = accountMatch[1];
      parsed.confidence += 0.1;
    }

    // Boost confidence if we have key elements
    if (parsed.amount && parsed.transactionType) {
      parsed.confidence = Math.min(parsed.confidence + 0.2, 1.0);
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
      if (keywords.some((kw) => lowerBody.includes(kw) || lowerMerchant.includes(kw))) {
        return category;
      }
    }

    // Check for specific transaction types
    if (TRANSACTION_KEYWORDS.ATM.some((kw) => lowerBody.includes(kw))) {
      return 'ATM';
    }

    if (TRANSACTION_KEYWORDS.SUBSCRIPTION.some((kw) => lowerBody.includes(kw))) {
      return 'SUBSCRIPTION';
    }

    if (TRANSACTION_KEYWORDS.TRANSFER.some((kw) => lowerBody.includes(kw))) {
      return 'TRANSFER';
    }

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
        include: {
          transaction: {
            select: {
              id: true,
              amount: true,
              category: true,
            },
          },
        },
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
