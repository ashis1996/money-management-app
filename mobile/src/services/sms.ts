import { Platform, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { api, ApiEnvelope } from './api';

/**
 * SMS ingestion service.
 *
 * The "auto" reading of SMS on Android requires a native module that
 * is not available in Expo Go (READ_SMS / RECEIVE_SMS broadcast receiver).
 * iOS does not allow third-party apps to read SMS at all - that's an
 * Apple platform restriction.
 *
 * What this service supports today:
 *   - Manual ingestion from the share sheet / clipboard
 *   - Batch ingestion of pre-collected SMS bodies
 *   - A hook point (`registerNativeSmsListener`) where the dev-build
 *     native module will plug in
 *
 * What requires a dev build to work fully:
 *   - Background SMS auto-detection (Android only)
 *   - UPI notification scraping (NotificationListenerService)
 */

export interface SmsIngestPayload {
  body: string;
  sender: string;
  timestamp?: string;
  phoneNumber?: string;
}

export interface SmsIngestResult {
  success: boolean;
  parsed?: any;
  transactionCreated?: boolean;
  transactionId?: string;
  error?: string;
}

const isExpoGo =
  Constants?.executionEnvironment === 'storeClient' ||
  Constants?.appOwnership === 'expo';

/**
 * Submit a single SMS to the backend for parsing.
 */
export async function ingestSms(
  payload: SmsIngestPayload,
): Promise<SmsIngestResult> {
  try {
    const res = await api.post<ApiEnvelope<SmsIngestResult>>('/sms/ingest', {
      body: payload.body,
      sender: payload.sender,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      phoneNumber: payload.phoneNumber,
    });
    return res.data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.response?.data?.message ?? err?.message ?? 'Network error',
    };
  }
}

/**
 * Submit multiple SMS in one call - useful for backfill imports
 * or batch-pushing accumulated messages.
 */
export async function ingestSmsBatch(payloads: SmsIngestPayload[]) {
  if (payloads.length === 0) return { success: true, processed: 0 };
  try {
    const res = await api.post<
      ApiEnvelope<{ processed: number; transactionsCreated: number }>
    >('/sms/ingest/batch', {
      messages: payloads.map((p) => ({
        body: p.body,
        sender: p.sender,
        timestamp: p.timestamp ?? new Date().toISOString(),
        phoneNumber: p.phoneNumber,
      })),
    });
    return res.data;
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Indicates whether the current build can read SMS in the background.
 * Always false in Expo Go and on iOS.
 */
export function canReadSmsInBackground(): boolean {
  if (isExpoGo) return false;
  if (Platform.OS !== 'android') return false;
  // The native module presence is checked by registerNativeSmsListener -
  // we mirror its absence/presence here for callers.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  try {
    // Will only resolve if a dev build with a native SMS listener is wired in.
    require('react-native-android-sms-listener');
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook point for plugging in a native SMS listener in a dev build.
 * Returns an unsubscribe function. In Expo Go this is a no-op.
 */
export function registerNativeSmsListener(
  handler: (sms: SmsIngestPayload) => void,
): () => void {
  if (!canReadSmsInBackground()) {
    if (Platform.OS === 'android' && isExpoGo) {
      console.info(
        '[sms] Native SMS listener unavailable in Expo Go. Use a dev build.',
      );
    }
    return () => undefined;
  }

  try {
    // Lazy require keeps Metro from choking when the package isn't installed.
    const SmsListener = require('react-native-android-sms-listener');
    const subscription = SmsListener.addListener((message: any) => {
      handler({
        body: message.body,
        sender: message.originatingAddress,
        timestamp: new Date(message.timestamp).toISOString(),
      });
    });
    return () => subscription?.remove?.();
  } catch (err) {
    console.warn('[sms] Failed to attach native SMS listener', err);
    return () => undefined;
  }
}

/**
 * Convenience: register listener that auto-forwards SMS to backend.
 * Skips messages from numeric+short senders that are unlikely to be banks.
 */
export function startSmsAutoCapture(): () => void {
  return registerNativeSmsListener(async (sms) => {
    if (!sms.body || !sms.sender) return;

    // Skip likely OTP/verification short codes (length 6 numeric)
    if (sms.body.length < 30) return;

    const result = await ingestSms(sms);
    if (result.transactionCreated) {
      console.info(
        `[sms] Auto-captured transaction ${result.transactionId} from ${sms.sender}`,
      );
    }
  });
}

/**
 * User-friendly explainer when SMS can't be read.
 * Used by OnboardingScreen / SettingsScreen to help users understand
 * what they get / lose by enabling SMS.
 */
export function smsReadingAvailability(): {
  available: boolean;
  message: string;
  fallback?: string;
} {
  if (Platform.OS === 'ios') {
    return {
      available: false,
      message: 'iOS does not allow third-party apps to read SMS.',
      fallback: 'You can manually paste or share SMS into the app.',
    };
  }
  if (isExpoGo) {
    return {
      available: false,
      message:
        'SMS auto-capture requires a custom build (not available in Expo Go).',
      fallback: 'Manual entry and SMS sharing from your messaging app still work.',
    };
  }
  return {
    available: true,
    message: 'SMS auto-capture is enabled.',
  };
}

/**
 * Open the OS settings page so the user can grant SMS permission.
 * Used as the action of an "Open Settings" button in onboarding.
 */
export async function openSystemSettings() {
  await Linking.openSettings();
}

/**
 * Helper used by the "Forward bank SMS" share-extension flow.
 * Accepts a raw shared text (with sender prefix like "VK-HDFCBK: ...")
 * and tries to extract sender + body before ingesting.
 */
export async function ingestSharedText(rawText: string) {
  // Try to detect "SENDER: body" pattern shared from messaging apps
  const senderMatch = rawText.match(/^([A-Z0-9-]{3,11})\s*[:\-]\s*([\s\S]+)$/);
  let sender: string;
  let body: string;
  if (senderMatch) {
    sender = senderMatch[1];
    body = senderMatch[2].trim();
  } else {
    sender = 'SHARED';
    body = rawText.trim();
  }

  return ingestSms({ body, sender });
}
