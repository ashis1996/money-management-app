# Native Modules — SMS, UPI, Push

Status as of commit `<this commit>`.

## What works in Expo Go

| Capability | Status | How |
|---|---|---|
| Push notifications (receive + tap) | ✅ Works | `expo-notifications` + Expo's free push service |
| Push token registration with backend | ✅ Works | `POST /api/v1/push/register` after login |
| Manual SMS forwarding | ✅ Works | `SmsForwardScreen` accepts pasted SMS |
| Manual transaction add | ✅ Works | `AddTransactionScreen` |

## What requires a custom dev build

These rely on Android-only system permissions that Expo Go can't grant.

### SMS auto-capture (Android only)

**Required:** `react-native-android-sms-listener` or a custom Expo config plugin.

```bash
# 1. Install the listener
npx expo install react-native-android-sms-listener

# 2. Build a dev client (one-time)
npx expo prebuild --platform android
npx expo run:android

# 3. SMS auto-capture starts automatically once the user grants permission.
```

The hook is already wired in `mobile/src/services/sms.ts`:
- `canReadSmsInBackground()` returns true once the package is present
- `startSmsAutoCapture()` (called from `App.tsx` on login) attaches the listener
- Each received SMS is forwarded to `POST /api/v1/sms/ingest`

### UPI notification scraping (Android only)

**Required:** A `NotificationListenerService` exposed as an Expo native module.

The work needed:

1. Create an Expo config plugin that:
   - Adds `<service android:name=".UpiNotificationService" android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">` to `AndroidManifest.xml`
   - Adds `<intent-filter><action android:name="android.service.notification.NotificationListenerService"/></intent-filter>`
2. Implement the service in Kotlin/Java to filter notifications by package (`com.google.android.apps.nbu.paisa.user`, `com.phonepe.app`, `net.one97.paytm`, etc.)
3. Forward parsed events through React Native bridge to JS
4. JS listener calls `POST /api/v1/sms/ingest` with `source=UPI` (we'd add this to `TransactionSource` enum)

This is non-trivial native work (~2 days). Punt for v1.

### iOS

- iOS does **not** allow third-party apps to read SMS. Period.
- iOS users get the manual SMS forward + manual entry flows only.
- Push notifications work normally.

## How to test push end-to-end (Expo Go)

```bash
# 1. Start backend
cd backend
npm run dev

# 2. Start mobile
cd ../mobile
npm run start

# 3. In Expo Go on a real device, log in.
#    The app calls registerForPushNotifications() automatically.

# 4. From Settings → "Send test push" or via curl:
curl -X POST http://localhost:3000/api/v1/push/test \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Hello from MoneyMind"}'
```

## Useful environment variables

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_ACCESS_TOKEN` | _unset_ | Optional — only needed for high-volume push sending |
| `PUSH_ENABLED` | `true` | Set to `false` in dev to disable outbound push calls |

## Token lifecycle

- A token is upserted on login (in `auth.store.login`) and on register
- The same token is unregistered on logout
- The backend marks tokens inactive when Expo returns `DeviceNotRegistered`
- A user can have multiple active tokens (one per device)
