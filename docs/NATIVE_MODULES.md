# Native Modules — SMS, UPI, Push

This document is the source of truth for everything in MoneyMind that needs the
Android OS to do work outside the React Native sandbox.

## Capability matrix

| Capability | Expo Go | Prebuild dev/release | Notes |
|---|---|---|---|
| Push receive + tap deep-link | ✅ | ✅ | `expo-notifications`, Expo push service |
| Manual SMS forwarding | ✅ | ✅ | `SmsForwardScreen` |
| SMS auto-capture (Android) | ❌ | ✅ | `react-native-android-sms-listener` |
| UPI notification capture (Android) | ❌ | ✅ | Custom NotificationListenerService |
| iOS auto-capture (any kind) | ❌ | ❌ | Apple platform restriction; manual flows only |

## One-time prebuild setup

After the v2 PR landed both native modules, the steps to bring up a fresh
dev build are:

```bash
cd mobile
npm install
npx expo prebuild --clean --platform android
npx expo run:android        # or: eas build --platform android --profile development
```

The `prebuild` step:
1. Generates the `android/` Gradle project.
2. Runs the `expo-notifications` and `expo-secure-store` plugins.
3. Runs `./plugins/withUpiNotificationListener.js`, which:
   - Adds `BIND_NOTIFICATION_LISTENER_SERVICE` to `AndroidManifest.xml`.
   - Registers `<service>` with the matching intent filter.
   - Copies our Kotlin sources from `plugins/native/upi-listener/` into
     `android/app/src/main/java/com/moneymind/app/upilistener/`.
   - Patches `MainApplication.{kt|java}` to register `UpiNotificationPackage`.

Both the `android/` directory and any prebuild-generated permission entries
should remain *out of* git — the plugin re-applies them on every prebuild run.

## SMS auto-capture (Android)

### How it works

- Permissions `RECEIVE_SMS` and `READ_SMS` are declared in
  `mobile/app.json` under `android.permissions`. `expo prebuild` copies them
  into `AndroidManifest.xml`.
- `mobile/src/services/sms.ts` lazily requires
  `react-native-android-sms-listener`. The presence of that module is
  itself the runtime feature flag — `canReadSmsInBackground()` returns
  `true` only once it's linked.
- On login, `App.tsx` calls `startSmsAutoCapture()` which attaches the
  listener. Every incoming SMS is forwarded to
  `POST /api/v1/sms/ingest` with `source: 'SMS'`.
- The user grants the permission during onboarding via
  `requestSmsRuntimePermission()` (PermissionsAndroid). The Settings
  screen polls `hasSmsRuntimePermission()` on resume so the toggle
  always reflects reality.

### What can go wrong

- **No SMS ever forwarded.** Open Settings → Apps → MoneyMind →
  Permissions → SMS. If the toggle is off, JS can't capture.
- **Listener silently no-ops.** Confirm you're on a prebuild, not Expo
  Go. `Constants.appOwnership` should be `null` or `'standalone'`.
- **Duplicate transactions.** Backend `SmsService.ingestSms` dedups on
  amount + ±2 min window + type, so a UPI notification followed by the
  bank SMS for the same payment will collapse into one transaction.

## UPI notification capture (Android)

UPI apps post a system notification on every payment. We listen to those
notifications via a `NotificationListenerService` and forward the text
through the same `/sms/ingest` pipeline.

### Why notifications, not SMS

UPI payments below ~₹X don't always trigger an SMS, and on dual-SIM
devices the SMS may land on the wrong SIM. UPI app notifications fire
within a second of the payment regardless.

### Architecture

```
┌─────────────────────────┐
│  UPI app (PhonePe etc.) │
│  posts notification     │
└──────────┬──────────────┘
           │ Android system
           ▼
┌─────────────────────────────────────────┐
│ UpiNotificationListenerService (Kotlin) │  <- runs even when the app is dead
│   filter by package allow-list          │
│   filter for currency mention           │
│   buffer to SharedPreferences           │
│   notify in-process bus                 │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ UpiNotificationModule (RN bridge)       │
│   start/stop, drain buffer, settings    │
└──────────┬──────────────────────────────┘
           │ DeviceEventEmitter
           ▼
┌─────────────────────────────────────────┐
│ services/upi-listener.ts                │
│   forwardNotification → /sms/ingest     │
│     with source: 'UPI_NOTIFICATION'     │
└─────────────────────────────────────────┘
```

### Source layout

| File | Role |
|---|---|
| `plugins/native/upi-listener/android/.../UpiNotificationListenerService.kt` | The system-bound listener |
| `plugins/native/upi-listener/android/.../UpiNotificationModule.kt` | RN bridge module |
| `plugins/native/upi-listener/android/.../UpiNotificationPackage.kt` | RN package registration |
| `plugins/native/upi-listener/android/.../UpiNotificationStore.kt` | Disk FIFO buffer (capped at 200) |
| `plugins/native/upi-listener/android/.../UpiNotificationBus.kt` | In-process callback bus |
| `plugins/withUpiNotificationListener.js` | Expo config plugin |
| `src/services/upi-listener.ts` | JS wrapper used by the rest of the app |

### Granting the permission

Notification Access **cannot** be requested in-app — Android requires
the user to flip the toggle in system Settings themselves. Both
Onboarding and the Settings screen do `openUpiPermissionSettings()`,
which deep-links to `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`.
Once granted, the OS binds our service and it survives reboots.

### Buffering when the app is dead

The Kotlin service writes every captured notification to
`SharedPreferences("upi_notification_listener", "buffer")` as a JSON
array, capped at 200 entries. On the next app launch
`startUpiAutoCapture()` calls `getBufferedNotifications()` which
returns + clears the buffer; we forward each entry to the backend in
order.

### Default app allow-list

The service ignores notifications whose package isn't on the allow-list
defined at the top of `UpiNotificationListenerService.kt`. Out of the
box we cover PhonePe, Google Pay (Tez), Paytm, BHIM, Amazon Pay UPI,
CRED, WhatsApp Pay, MobiKwik, Freecharge, BOB UPI, Axis Pay, ICICI
iMobile, HDFC, and SBI UPI. JS can extend this at runtime via
`setSupportedUpiPackages([...])` — useful for regional or in-house bank
apps that we don't ship by default.

## iOS

- iOS does not allow third-party apps to read SMS. Period.
- iOS doesn't expose a notification-listener API to user apps either.
- iOS users get manual SMS forward, manual entry, and push notifications.

## Testing

### Push (Expo Go is fine)

```bash
# 1. Start the backend
cd backend && npm run dev

# 2. Run the app
cd ../mobile && npm run start

# 3. Log in on a real device. The app upserts a push token automatically.

# 4. Trigger a test push
curl -X POST http://localhost:3000/api/v1/push/test \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Hello from MoneyMind"}'
```

### SMS auto-capture (requires prebuild)

```bash
# 1. Build the dev client
cd mobile
npx expo prebuild --clean --platform android
npx expo run:android

# 2. In the app: Onboarding → enable SMS, grant the system prompt.
#    Or: Settings → Capture Modes → SMS parsing.

# 3. Send yourself a fake bank SMS via adb:
adb emu sms send VK-HDFCBK \
  "Rs 1499.00 debited from a/c ending 1234 at Netflix. Avl bal: 12,345.00."

# 4. Check the backend log — you should see /sms/ingest being hit
#    and the resulting transaction appear in /api/v1/transactions.
```

### UPI capture (requires prebuild + a real device with UPI apps)

```bash
# 1. Build & install the dev client on a real Android device.
# 2. Onboarding → enable "UPI notifications" → tap through to system
#    settings → enable Notification Access for MoneyMind.
# 3. Make a small UPI payment from PhonePe/GPay/Paytm to anyone.
# 4. The app shows the transaction within 1-2 seconds.
#    Backend logs will mention `source=UPI` on the new tx.
```

## Useful environment variables

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_ACCESS_TOKEN` | _unset_ | Optional — only for high-volume push sending |
| `PUSH_ENABLED` | `true` | Set `false` in dev to disable outbound push calls |
| `SMS_USE_AI_PARSER` | `true` | Set `false` to skip the AI parse hop and always use the backend regex parser |

## Token lifecycle (push)

- Upserted on login (`auth.store.login`) and register
- Unregistered on logout
- Backend marks tokens inactive when Expo returns `DeviceNotRegistered`
- A user can have multiple active tokens (one per device)
