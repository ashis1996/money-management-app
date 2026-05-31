import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
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
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000/api/v1',
    );
    // Allow ops to disable the AI parser via env without redeploy.
    this.useAiParser = this.configService.get<string>('SMS_USE_AI_PARSER', 'true') !== 'false';
  }

  /**
   * Deterministic dedup key for an SMS.
   *
   * The same SMS replayed (e.g. mobile app retrying after a flaky network,
   * or a backfill importing the user's full inbox twice) must not create a
   * second Transaction row. We hash the immutable fields the device knows
   * about — sender, body, and the timestamp it observed — scoped per user.
   *
   * Timestamp is normalized to whole seconds so device-clock jitter on
   * retry doesn't break the match.
   */
  private computeDedupHash(userId: string, sender: string, body: string, receivedAt: Date): string {
    const stableTimestamp = Math.floor(receivedAt.getTime() / 1000);
    return createHash('sha256')
      .update(`${userId}|${sender}|${body}|${stableTimestamp}`)
      .digest('hex');
  }

  async ingestSms(userId: string, dto: SmsIngestDto): Promise<SmsParseResponseDto> {
    const receivedAt = new Date((dto.timestamp ?? dto.receivedAt ?? new Date()) as any);
    const dedupHash = this.computeDedupHash(userId, dto.sender, dto.body, receivedAt);

    // ---------------------------------------------------------------
    // Idempotency short-circuit: if we've already ingested this exact
    // SMS for this user, return the previous result instead of doing
    // any work. Without this, two identical /sms/ingest calls would
    // create two SmsLogs and two Transactions.
    // ---------------------------------------------------------------
    const existingTx = await this.prisma.transaction.findUnique({
      where: { userId_externalReferenceId: { userId, externalReferenceId: dedupHash } },
    });
    if (existingTx) {
      this.logger.debug(
        `Duplicate SMS ingest detected (hash=${dedupHash.slice(0, 8)}…); reusing tx=${existingTx.id}`,
      );
      // Return a synthesized response that matches what the original call
      // would have produced. We avoid re-parsing the SMS — the original
      // parse is canonical.
      return {
        success: true,
        parsed: {
          rawSms: dto.body,
          sender: dto.sender,
          timestamp: receivedAt,
          amount: Number(existingTx.amount),
          merchant: existingTx.merchantName ?? undefined,
          transactionType: existingTx.type as TransactionType,
          category: existingTx.categoryId ?? undefined,
          confidence: existingTx.aiConfidence ? Number(existingTx.aiConfidence) : 0,
        },
        transactionCreated: false,
        transactionId: existingTx.id,
      };
    }

    // Persist the raw SMS first so we always have an audit trail even if
    // parsing or transaction creation later fails.
    const smsLog = await this.prisma.smsLog.create({
      data: {
        userId,
        body: dto.body,
        sender: dto.sender,
        phoneNumber: dto.phoneNumber,
        receivedAt,
        isProcessed: false,
      },
    });

    const parsed = await this.parseSms(dto.body, dto.sender, receivedAt);

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
        // Upsert against the (userId, externalReferenceId) unique index so
        // a concurrent duplicate (e.g. two mobile clients firing ingest at
        // once) collapses cleanly instead of throwing or double-inserting.
        const transaction = await this.prisma.transaction.upsert({
          where: {
            userId_externalReferenceId: { userId, externalReferenceId: dedupHash },
          },
          create: {
            userId,
            amount: parsed.amount,
            type: parsed.transactionType as any,
            categoryId: parsed.category,
            merchantName: parsed.merchant,
            transactionDate: parsed.timestamp,
            rawSmsText: dto.body,
            smsSenderId: dto.sender,
            source: 'SMS',
            externalReferenceId: dedupHash,
            // Preserve AI parse hints for the auto-actions consumer to refine.
            aiSuggestedCategory: parsed.category ?? null,
            aiSuggestedMerchant: parsed.merchant ?? null,
            aiConfidence: parsed.confidence ?? null,
          },
          update: {}, // Race winner already wrote; no-op on conflict.
        });

        await this.prisma.smsLog.update({
          where: { id: smsLog.id },
          data: { transactionId: transaction.id },
        });

        transactionCreated = transaction.createdAt.getTime() === transaction.updatedAt.getTime();
        transactionId = transaction.id;

        // Single source of truth for downstream fan-out: notifications,
        // subscription detection, AI enrichment, etc. all happen via the
        // transaction.created consumer. We deliberately do NOT publish
        // sms.received any more — the consumer that handled it was the
        // duplicate path and has been removed.
        if (transactionCreated) {
          await this.rabbitMQ.publishTransactionCreated({
            transactionId: transaction.id,
            userId,
            amount: parsed.amount,
            category: parsed.category || 'UNKNOWN',
          });
        }
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
        // Include the linked transaction (when one was created) so the
        // SMS history view can show amount + category without a second
        // round-trip per row. The relation is declared in schema.prisma;
        // see migration 20260531000003.
        include: {
          transaction: {
            select: { id: true, amount: true, categoryId: true },
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
