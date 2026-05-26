import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api, ApiEnvelope } from './api';

/**
 * Configure how foreground notifications are presented.
 * Default behaviour shows banner + plays sound + sets badge.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // SDK 50+ shape
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

export interface PushRegistrationResult {
  granted: boolean;
  token?: string;
  reason?: string;
}

const STATUS_CACHE_KEY = '_pushPermissionStatus';
let cachedToken: string | undefined;

/**
 * Request permission and (if granted) fetch the Expo push token.
 * Uses Constants.expoConfig.extra.eas.projectId when available, else falls
 * back to the legacy Expo flow.
 */
async function getExpoPushToken(): Promise<string | undefined> {
  if (cachedToken) return cachedToken;

  if (!Device.isDevice) {
    // Push notifications don't work on simulators/emulators
    return undefined;
  }

  // Pull projectId from app config so the token is scoped correctly.
  const projectId =
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants?.easConfig as any)?.projectId ??
    undefined;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    cachedToken = tokenData.data;
    return cachedToken;
  } catch (err) {
    // Most common failure: no projectId in standalone build, or no network.
    console.warn('[push] getExpoPushTokenAsync failed', err);
    return undefined;
  }
}

/**
 * Request the OS-level notification permission, get a push token,
 * and register it with the backend. Safe to call multiple times.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { granted: false, reason: 'Not a physical device' };
  }

  // Android requires an explicit channel for high-importance notifications
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'MoneyMind alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });

    await Notifications.setNotificationChannelAsync('budget', {
      name: 'Budget alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });

    await Notifications.setNotificationChannelAsync('subscription', {
      name: 'Subscription reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return { granted: false, reason: 'Permission denied' };
  }

  const token = await getExpoPushToken();
  if (!token) {
    return { granted: true, reason: 'Could not generate Expo push token' };
  }

  // Register with backend - swallow errors so a network blip doesn't
  // block the rest of the auth flow.
  try {
    await api.post<ApiEnvelope<any>>('/push/register', {
      token,
      platform: Platform.OS,
      deviceId: Device.osBuildId ?? Device.modelId ?? undefined,
      appVersion: Constants?.expoConfig?.version,
    });
  } catch (err) {
    console.warn('[push] Failed to register token with backend', err);
  }

  return { granted: true, token };
}

/**
 * Listen for incoming push notifications.
 * Returns an unsubscribe function.
 */
export function addNotificationListeners(handlers: {
  onReceived?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}) {
  const subs: Array<{ remove: () => void }> = [];

  if (handlers.onReceived) {
    subs.push(Notifications.addNotificationReceivedListener(handlers.onReceived));
  }
  if (handlers.onResponse) {
    subs.push(
      Notifications.addNotificationResponseReceivedListener(handlers.onResponse),
    );
  }

  return () => {
    subs.forEach((s) => s.remove());
  };
}

/**
 * Unregister the current device's token (e.g. on logout).
 */
export async function unregisterPushToken() {
  if (!cachedToken) return;
  try {
    await api.delete<ApiEnvelope<any>>(
      `/push/tokens/${encodeURIComponent(cachedToken)}`,
    );
  } catch (err) {
    console.warn('[push] Failed to unregister token', err);
  } finally {
    cachedToken = undefined;
  }
}
