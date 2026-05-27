import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import {
  SmsIngestDto,
  SmsParseResponseDto,
  ParsedSmsDto,
  TransactionType,
} from '@money-management/shared/dto';
import { Logger } from '../../common/utils/logger';
import {
  TRANSACTION_KEYWORDS,
  CATEGORY_MAPPINGS,
  BANK_SENDER_MAPPING,
} from '@money-management/shared/constants';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly aiServiceUrl: string;
  private readonly useAiParser: boolean;

  constructor(
    private prisma: PrismaService,
    private rabbitMQ: RabbitMQService,
    private configService: ConfigService,
    private aiProxy: AiProxyService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000/api/v1');
    // Allow ops to disable the AI parser via env without redeploy.
    this.useAiParser = this.configService.get<string>('SMS_USE_AI_PARSER', 'true') !== 'false';
  }

  async ingestSms(userId: string, dto: SmsIngestDto): Promise<SmsParseResponseDto> {
    const receivedAt = dto.timestamp ?? dto.receivedAt ?? new Date();

    // Translate the wire-format source into the Prisma TransactionSource enum.
    const ingestSource = dto.source ?? 'SMS';
    const txSource: 'SMS' | 'UPI' | 'MANUAL' =
      ingestSource === 'UPI_NOTIFICATION'
        ? 'UPI'
        : ingestSource === 'MANUAL'
          ? 'MANUAL'
          : 'SMS';

    const smsLog = await this.prisma.smsLog.create({
      data: {
        userId,
        body: dto.body,
        sender: dto.sender,
        phoneNumber: dto.phoneNumber,
        receivedAt: new Date(receivedAt as any),
        isProcessed: false,
        // Stash the wire-source + originating package on the log row for
        // forensics — the SmsLog model doesn't have dedicated columns yet.
        parsedData: {
          ingestSource,
          packageName: dto.packageName ?? null,
        } as any,
      },
    });

    // Best-effort: tell downstream consumers about the new SMS. Failures
    // here must not block transaction creation below.
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
        parsedData: {
          ingestSource,
          packageName: dto.packageName ?? null,
          ...(parsed as any),
        } as any,
      },
    });

    let transactionCreated = false;
    let transactionId: string | undefined;

    if (parsed.amount && parsed.transactionType) {
      // ----- Dedup against same payment arriving via two channels -----
      // Bank SMS and UPI app notification often fire within seconds of
      // each other for the same payment. Match on userId + amount + type
      // within a ±2 min window — conservative enough to avoid false
      // merges of unrelated payments of the same value.
      const matchWindowMs = 2 * 60 * 1000;
      const dedupTimestamp = parsed.timestamp ?? new Date(receivedAt as any);
      const existing = await this.prisma.transaction.findFirst({
        where: {
          userId,
          type: parsed.transactionType as any,
          amount: parsed.amount,
          deletedAt: null,
          transactionDate: {
            gte: new Date(dedupTimestamp.getTime() - matchWindowMs),
            lte: new Date(dedupTimestamp.getTime() + matchWindowMs),
          },
        },
        orderBy: { transactionDate: 'desc' },
      });

      if (existing) {
        // Link this SmsLog to the canonical transaction and bail.
        await this.prisma.smsLog.update({
          where: { id: smsLog.id },
          data: { transactionId: existing.id },
        });

        // If the new ingest provided a richer merchant name and the
        // existing row didn't have one, fill it in. Cheap improvement.
        if (parsed.merchant && !existing.merchantName) {
          await this.prisma.transaction.update({
            where: { id: existing.id },
            data: { merchantName: parsed.merchant },
          });
        }

        this.logger.debug(
          `Dedup: ingest from ${ingestSource} matched existing tx ${existing.id}`,
        );

        return {
          success: true,
          parsed: { ...parsed, duplicate: true } as ParsedSmsDto,
          transactionCreated: false,
          transactionId: existing.id,
        };
      }

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
            source: txSource,
            // Preserve AI parse hints for the auto-actions consumer to refine.
            aiSuggestedCategory: parsed.category ?? null,
            aiSuggestedMerchant: parsed.merchant ?? null,
            aiConfidence: parsed.confidence ?? null,
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

  /**
   * Parse a single SMS. Tries the AI service first (better extraction via
   * spaCy + bank-specific patterns) and falls back to the local regex parser
   * if the AI service is unreachable, slow, or returns insufficient data.
   *
   * The fallback is silent — ops can flip SMS_USE_AI_PARSER=false to skip
   * the AI hop entirely if the service is misbehaving.
   */
  async parseSms(body: string, sender: string, timestamp: Date): Promise<ParsedSmsDto> {
    if (this.useAiParser) {
      try {
        const aiResponse = (await this.aiProxy.parseSms(
          body,
          sender,
          timestamp.toISOString(),
        )) as any;

        const aiParsed = this.adaptAiParsedResponse(aiResponse, body, sender, timestamp);
        // Only trust the AI parse if it actually pulled out the core fields.
        if (aiParsed.amount && aiParsed.transactionType) {
          return aiParsed;
        }
        this.logger.debug(
          `AI parse incomplete (amount=${aiParsed.amount} type=${aiParsed.transactionType}); falling back to regex.`,
        );
      } catch (error: any) {
        this.logger.debug(
          `AI SMS parse unavailable, using regex fallback: ${error?.message ?? error}`,
        );
      }
    }
    return this.parseSmsLocal(body, sender, timestamp);
  }

  /**
   * Translate the snake_case shape returned by the FastAPI service into the
   * camelCase ParsedSmsDto the rest of the backend expects.
   */
  private adaptAiParsedResponse(
    response: any,
    body: string,
    sender: string,
    timestamp: Date,
  ): ParsedSmsDto {
    const inner = response?.parsed ?? response?.data?.parsed ?? response?.data ?? response ?? {};
    const txType = inner.transaction_type ?? inner.transactionType;
    return {
      rawSms: body,
      sender,
      timestamp,
      amount: typeof inner.amount === 'number' ? inner.amount : undefined,
      merchant: inner.merchant ?? inner.merchantName ?? undefined,
      transactionType:
        txType === 'CREDIT'
          ? TransactionType.CREDIT
          : txType === 'DEBIT'
            ? TransactionType.DEBIT
            : undefined,
      category: inner.category ?? this.categorizeTransaction(body, inner.merchant),
      balance: typeof inner.balance === 'number' ? inner.balance : undefined,
      accountLast4: inner.account_last_4 ?? inner.accountLast4 ?? undefined,
      confidence:
        typeof response?.confidence === 'number'
          ? response.confidence
          : typeof inner.confidence === 'number'
            ? inner.confidence
            : 0,
    };
  }

  /**
   * Local regex parser. Used as a fallback when the AI service is unreachable
   * and as the primary path when SMS_USE_AI_PARSER=false.
   */
  private async parseSmsLocal(
    body: string,
    sender: string,
    timestamp: Date,
  ): Promise<ParsedSmsDto> {
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
