import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RegisterPushTokenDto } from './dto/push.dto';

/**
 * Shape returned by Expo's push API.
 */
interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

/**
 * Sends notifications via Expo's push service. Works with Expo Go and
 * standalone builds. We avoid pulling expo-server-sdk to keep the dep
 * footprint small; the protocol is just an HTTP POST to /v2/push/send.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';
  private readonly expoAccessToken?: string;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.expoAccessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    // Allow disabling push entirely in dev so missing internet doesn't break flows.
    this.enabled = this.config.get<string>('PUSH_ENABLED', 'true') === 'true';
  }

  async registerToken(userId: string, dto: RegisterPushTokenDto) {
    // Upsert by token (one token can move between users if reinstall etc.)
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      const updated = await this.prisma.deviceToken.update({
        where: { token: dto.token },
        data: {
          userId,
          platform: dto.platform,
          deviceId: dto.deviceId ?? existing.deviceId,
          appVersion: dto.appVersion ?? existing.appVersion,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
      return updated;
    }

    return this.prisma.deviceToken.create({
      data: {
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
    return { message: 'Token unregistered' };
  }

  async listUserTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Send a push notification to all active tokens for a user.
   * Failures don't throw - we log and disable bad tokens.
   */
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, any> },
  ) {
    if (!this.enabled) {
      this.logger.debug(`Push disabled, skipping: ${payload.title}`);
      return { sent: 0, skipped: true };
    }

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
    });

    if (tokens.length === 0) {
      this.logger.debug(`No active tokens for user ${userId}`);
      return { sent: 0 };
    }

    const expoTokens = tokens.filter((t) => this.isExpoToken(t.token));
    const fcmTokens = tokens.filter((t) => !this.isExpoToken(t.token));

    let sent = 0;

    if (expoTokens.length > 0) {
      const messages = expoTokens.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        priority: 'high',
        sound: 'default',
      }));

      try {
        const tickets = await this.postExpoChunk(messages);
        // Disable any tokens that came back as DeviceNotRegistered
        await this.processTickets(tickets, expoTokens);
        sent += tickets.filter((t) => t.status === 'ok').length;
      } catch (err: any) {
        this.logger.error(`Expo push failed: ${err?.message ?? 'unknown'}`);
      }
    }

    if (fcmTokens.length > 0) {
      // Raw FCM tokens are not supported here yet; would need firebase-admin.
      // We log + leave them on the user record.
      this.logger.warn(
        `Skipping ${fcmTokens.length} non-Expo tokens (FCM not implemented)`,
      );
    }

    // Update lastUsedAt for tokens we tried
    if (expoTokens.length > 0) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: expoTokens.map((t) => t.id) } },
        data: { lastUsedAt: new Date() },
      });
    }

    return { sent, attempted: expoTokens.length };
  }

  /**
   * Smoke-test endpoint: send a push to the calling user with a default message.
   */
  async testPush(userId: string, title?: string, body?: string) {
    return this.sendToUser(userId, {
      title: title ?? 'Test from MoneyMind',
      body: body ?? 'If you see this, push notifications are working',
      data: { type: 'TEST', userId },
    });
  }

  private isExpoToken(token: string) {
    return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
  }

  private async postExpoChunk(messages: any[]): Promise<ExpoPushTicket[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.expoAccessToken) {
      headers.Authorization = `Bearer ${this.expoAccessToken}`;
    }

    const res = await fetch(this.expoPushUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      throw new Error(`Expo push HTTP ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    return json.data ?? [];
  }

  private async processTickets(
    tickets: ExpoPushTicket[],
    tokens: { id: string; token: string }[],
  ) {
    const badTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        const error = ticket.details?.error;
        if (
          error === 'DeviceNotRegistered' ||
          error === 'InvalidCredentials' ||
          error === 'MessageTooBig' ||
          error === 'MessageRateExceeded'
        ) {
          // DeviceNotRegistered means uninstall/refresh - permanently disable
          if (error === 'DeviceNotRegistered' && tokens[i]) {
            badTokens.push(tokens[i].id);
          }
          this.logger.warn(`Push error for token ${tokens[i]?.token}: ${error}`);
        }
      }
    });

    if (badTokens.length > 0) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: badTokens } },
        data: { isActive: false },
      });
      this.logger.log(`Disabled ${badTokens.length} dead push tokens`);
    }
  }
}
