package com.moneymind.app.upilistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Listens for system notifications posted by Indian UPI apps and forwards
 * the payment-relevant ones to the React-Native layer.
 *
 * UPI apps (PhonePe, GPay, Paytm, BHIM, ...) post a notification for
 * every transaction. Many banks also send an SMS, but a) some banks
 * don't, b) UPI notifications usually arrive seconds before the SMS,
 * and c) on dual-SIM devices SMS may land on the wrong SIM. Listening
 * to UPI notifications fills these gaps.
 *
 * The service is bound by the OS (after the user grants Notification
 * Access in system settings) and survives app restarts. It runs in the
 * same process as the React-Native app.
 *
 * Capture flow:
 *   1. Filter notifications by package name against [supportedPackages].
 *   2. Concatenate title + text + bigText + subText into one body.
 *   3. Drop notifications that don't mention currency — kills marketing
 *      and KYC pings without missing real payments.
 *   4. Push the live notification to [UpiNotificationBus] for the JS
 *      bridge if it's listening.
 *   5. Always persist to [UpiNotificationStore] so the JS layer can
 *      drain the buffer when the user foregrounds the app.
 */
class UpiNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "UpiNotifListener"

        /**
         * Default UPI app packages we care about. The JS layer can replace
         * this list at runtime via the bridge module's
         * `setSupportedPackages` method, e.g. to add region-specific apps.
         */
        @Volatile
        @JvmStatic
        var supportedPackages: Set<String> = setOf(
            "com.phonepe.app",                         // PhonePe
            "com.google.android.apps.nbu.paisa.user",  // Google Pay (Tez)
            "net.one97.paytm",                         // Paytm
            "in.org.npci.upiapp",                      // BHIM
            "com.amazon.mShop.android.shopping",       // Amazon Pay UPI
            "in.amazon.mShop.android.shopping",        // Amazon Pay UPI (alt)
            "com.dreamplug.androidapp",                // CRED
            "com.whatsapp",                            // WhatsApp Pay
            "com.mobikwik_new",                        // MobiKwik
            "com.freecharge.android",                  // Freecharge
            "com.bankofbaroda.upi",                    // BOB UPI
            "com.upi.axispay",                         // Axis Pay
            "com.icicibank.imobile",                   // iMobile
            "com.snapwork.hdfc",                       // HDFC Bank
            "com.csam.icici.bank.imobile",             // ICICI iMobile
            "com.sbi.upi",                             // SBI UPI
        )

        /** Currency mention check — notifications that don't reference money
         *  are not payments. Kills marketing/KYC noise. */
        private val CURRENCY_PATTERN = Regex(
            "[₹]|\\bRs\\.?\\b|\\bINR\\b",
            RegexOption.IGNORE_CASE,
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notif = sbn?.notification ?: return
        val pkg = sbn.packageName ?: return

        if (!supportedPackages.contains(pkg)) {
            return
        }

        val extras = notif.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()

        val combined = listOf(title, text, bigText, subText)
            .filter { it.isNotBlank() }
            .joinToString("\n")

        if (combined.isBlank()) return
        if (!CURRENCY_PATTERN.containsMatchIn(combined)) return

        val payload: Map<String, Any?> = mapOf(
            "packageName" to pkg,
            "title" to title,
            "text" to text,
            "bigText" to bigText,
            "subText" to subText,
            "combinedText" to combined,
            "postTime" to sbn.postTime,
            "capturedAt" to System.currentTimeMillis(),
        )

        // Real-time path: notify the bridge module if the JS layer is up.
        try {
            UpiNotificationBus.onNotification?.invoke(payload)
        } catch (t: Throwable) {
            Log.w(TAG, "Bus dispatch failed", t)
        }

        // Persist regardless — the JS layer might drop the live event
        // (e.g. mid-reload) and we always want a recoverable copy.
        UpiNotificationStore.append(applicationContext, payload)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // We only care about posted (newly-arrived) notifications; removal
        // is not a payment event. Intentional no-op.
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "UPI notification listener connected; ${supportedPackages.size} packages tracked")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.i(TAG, "UPI notification listener disconnected")
    }
}
