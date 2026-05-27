/**
 * JS wrapper around the native UpiNotificationModule (see
 * mobile/plugins/native/upi-listener/android).
 *
 * Responsibilities:
 *   - Detect whether the native module is present (i.e. user is on a
 *     prebuild dev/release build, not Expo Go).
 *   - Expose a stable TS API for the rest of the app to consume.
 *   - Convert raw notifications into transactions by forwarding them
 *     to /sms/ingest with `source: 'UPI_NOTIFICATION'`.
 *   - Drain the on-disk buffer of notifications captured while the JS
 *     layer was dead, then subscribe to live events.
 *
 * The native module is referenced via `NativeModules.UpiNotificationModule`
 * and exposes:
 *   - isPermissionGranted(): Promise<boolean>
 *   - openSettings(): Promise<boolean>
 *   - start(): Promise<void>
 *   - stop(): Promise<void>
 *   - getBufferedNotifications(): Promise<UpiNotification[]>
 *   - getBufferedCount(): Promise<number>
 *   - setSupportedPackages(pkgs: string[]): Promise<void>
 */

import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  EmitterSubscription,
} from 'react-native';
import Constants from 'expo-constants';
import { ingestSms } from './sms';

export interface UpiNotification {
  packageName: string;
  title: string;
  text: string;
  bigText?: string;
  subText?: string;
  combinedText: string;
  postTime: number;
  capturedAt: number;
}

export interface UpiListenerStatus {
  /** Native module is linked into the running build. False in Expo Go. */
  available: boolean;
  /** OS-level Notification Access has been granted to MoneyMind. */
  permissionGranted: boolean;
  /** A live event subscription is currently attached. */
  listening: boolean;
  /** Notifications captured while the JS layer was dead. Drained on connect. */
  bufferedCount: number;
}

const MODULE_NAME = 'UpiNotificationModule';
const EVENT_NAME = 'UpiNotification';

const isExpoGo =
  Constants?.executionEnvironment === 'storeClient' ||
  Constants?.appOwnership === 'expo';

/** Map of UPI app package names to a normalised "sender" string used by
 *  the backend SMS parser. The parser just needs something stable to
 *  index against; the actual content is in the body. */
const PACKAGE_SENDER_MAP: Record<string, string> = {
  'com.phonepe.app': 'PHONEPE',
  'com.google.android.apps.nbu.paisa.user': 'GPAY',
  'net.one97.paytm': 'PAYTM',
  'in.org.npci.upiapp': 'BHIM',
  'com.amazon.mShop.android.shopping': 'AMAZONPAY',
  'in.amazon.mShop.android.shopping': 'AMAZONPAY',
  'com.dreamplug.androidapp': 'CRED',
  'com.whatsapp': 'WHATSAPPPAY',
  'com.mobikwik_new': 'MOBIKWIK',
  'com.freecharge.android': 'FREECHARGE',
  'com.bankofbaroda.upi': 'BOBUPI',
  'com.upi.axispay': 'AXISPAY',
  'com.icicibank.imobile': 'ICICI',
  'com.snapwork.hdfc': 'HDFC',
  'com.csam.icici.bank.imobile': 'ICICI',
  'com.sbi.upi': 'SBI',
};

function getModule(): any | null {
  if (Platform.OS !== 'android') return null;
  // The whole point of expo prebuild + the config plugin is to register
  // this native module. In Expo Go it is intentionally absent.
  const mod = (NativeModules as any)[MODULE_NAME];
  return mod ?? null;
}

let liveSubscription: EmitterSubscription | null = null;

/** True iff the native UPI listener module is linked into this build. */
export function isUpiListenerAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  if (isExpoGo) return false;
  return getModule() !== null;
}

/** Whether the user has granted Notification Access to MoneyMind. */
export async function isUpiPermissionGranted(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    return await mod.isPermissionGranted();
  } catch {
    return false;
  }
}

/** Open the Android Notification Access settings page. The user has to
 *  manually flip the toggle for MoneyMind there — the OS does not allow
 *  in-app permission prompts for this capability. */
export async function openUpiPermissionSettings(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    await mod.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function getUpiListenerStatus(): Promise<UpiListenerStatus> {
  if (!isUpiListenerAvailable()) {
    return {
      available: false,
      permissionGranted: false,
      listening: false,
      bufferedCount: 0,
    };
  }

  const mod = getModule();
  const [granted, buffered] = await Promise.all([
    mod.isPermissionGranted().catch(() => false),
    mod.getBufferedCount().catch(() => 0),
  ]);

  return {
    available: true,
    permissionGranted: !!granted,
    listening: liveSubscription !== null,
    bufferedCount: buffered ?? 0,
  };
}

/**
 * Start auto-capture of UPI notifications.
 *
 *  1. Drain anything the OS-managed listener buffered while the JS layer
 *     was dead, forwarding each to /sms/ingest.
 *  2. Subscribe to the live `UpiNotification` event and forward every
 *     new notification.
 *
 * Returns a stop() function that unsubscribes.
 *
 * No-op if the native module isn't linked or the user hasn't granted
 * Notification Access — call `openUpiPermissionSettings()` first if
 * `getUpiListenerStatus().permissionGranted` is false.
 */
export async function startUpiAutoCapture(): Promise<() => void> {
  if (!isUpiListenerAvailable()) {
    return () => undefined;
  }

  const mod = getModule();

  // Drain on connect — best-effort, never throw.
  try {
    const buffered: UpiNotification[] = await mod.getBufferedNotifications();
    if (Array.isArray(buffered) && buffered.length > 0) {
      // Sequential forward to keep the order the user actually saw.
      for (const n of buffered) {
        await forwardNotification(n).catch(() => undefined);
      }
    }
  } catch (err) {
    if (__DEV__) console.warn('[upi-listener] drain failed', err);
  }

  // Subscribe to live notifications.
  try {
    await mod.start();
  } catch (err) {
    if (__DEV__) console.warn('[upi-listener] start failed', err);
  }

  const emitter = new NativeEventEmitter(mod);

  // Defensive: kill any prior subscription before installing a new one.
  liveSubscription?.remove();
  liveSubscription = emitter.addListener(EVENT_NAME, (n: UpiNotification) => {
    forwardNotification(n).catch((err) => {
      if (__DEV__) console.warn('[upi-listener] forward failed', err);
    });
  });

  return () => {
    liveSubscription?.remove();
    liveSubscription = null;
    mod.stop?.().catch(() => undefined);
  };
}

/** Forward a single captured notification to the backend SMS ingest
 *  pipeline. Uses `source: 'UPI_NOTIFICATION'` so the backend can:
 *    - label the resulting Transaction with `source = UPI`,
 *    - dedup against any concurrent bank SMS for the same payment. */
async function forwardNotification(n: UpiNotification) {
  const body = (n.combinedText ?? '').trim();
  if (!body) return;

  const sender = PACKAGE_SENDER_MAP[n.packageName] ?? 'UPI_APP';
  const timestamp = new Date(n.postTime || n.capturedAt || Date.now()).toISOString();

  const result = await ingestSms({
    body,
    sender,
    timestamp,
    source: 'UPI_NOTIFICATION',
    packageName: n.packageName,
  });

  if (__DEV__) {
    if (result.transactionCreated) {
      console.info(
        `[upi-listener] captured tx ${result.transactionId} from ${sender}`,
      );
    } else if ((result as any).parsed?.duplicate) {
      console.info(
        `[upi-listener] duplicate of tx ${result.transactionId} from ${sender} (already ingested via SMS)`,
      );
    }
  }
}

/** Replace the package allow-list at runtime (e.g. to add a bank's
 *  in-house UPI app for a specific user). */
export async function setSupportedUpiPackages(packages: string[]): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    await mod.setSupportedPackages(packages);
  } catch (err) {
    if (__DEV__) console.warn('[upi-listener] setSupportedPackages failed', err);
  }
}

/** Human-readable explainer for use in onboarding/settings UI. */
export function upiCaptureAvailability(): {
  available: boolean;
  message: string;
  fallback?: string;
} {
  if (Platform.OS !== 'android') {
    return {
      available: false,
      message: 'UPI notification capture is Android-only.',
      fallback: 'Use SMS auto-capture or paste UPI receipts manually.',
    };
  }
  if (isExpoGo) {
    return {
      available: false,
      message:
        'UPI capture requires a custom build (not available in Expo Go).',
      fallback: 'Manual SMS forwarding still works in Expo Go.',
    };
  }
  if (!isUpiListenerAvailable()) {
    return {
      available: false,
      message:
        'The UPI notification listener native module is not linked. Run `expo prebuild --clean && expo run:android`.',
    };
  }
  return {
    available: true,
    message: 'UPI auto-capture is supported. Grant Notification Access to enable.',
  };
}
