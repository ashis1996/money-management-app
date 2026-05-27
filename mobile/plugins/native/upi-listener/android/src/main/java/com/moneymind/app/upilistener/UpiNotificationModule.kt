package com.moneymind.app.upilistener

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

/**
 * React-Native bridge for the UPI notification listener.
 *
 * Exposed JS API (see mobile/src/services/upi-listener.ts):
 *   - isPermissionGranted(): Promise<boolean>
 *   - openSettings(): Promise<void>
 *   - start(): Promise<void>      — subscribes to live events
 *   - stop(): Promise<void>       — unsubscribes
 *   - getBufferedNotifications(): Promise<UpiNotification[]>
 *   - getBufferedCount(): Promise<number>
 *   - setSupportedPackages(pkgs: string[]): Promise<void>
 *
 * Live events are emitted as DeviceEventEmitter('UpiNotification', payload).
 */
class UpiNotificationModule(
    private val reactCtx: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactCtx) {

    override fun getName(): String = MODULE_NAME

    /** True iff the user has enabled Notification Access for this app. */
    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        try {
            val pkg = reactCtx.packageName
            val granted = NotificationManagerCompat
                .getEnabledListenerPackages(reactCtx)
                .contains(pkg)
            promise.resolve(granted)
        } catch (t: Throwable) {
            promise.reject("E_PERM_CHECK", t)
        }
    }

    /** Opens the system "Notification Access" page. The user has to flip
     *  the toggle for our app there — there is no in-app permission prompt
     *  for NotificationListenerService. */
    @ReactMethod
    fun openSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactCtx.startActivity(intent)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("E_OPEN_SETTINGS", t)
        }
    }

    /** Begin forwarding live notifications via DeviceEventEmitter. */
    @ReactMethod
    fun start(promise: Promise) {
        UpiNotificationBus.onNotification = { payload ->
            try {
                val map = payload.toWritableMap()
                reactCtx
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_NAME, map)
            } catch (t: Throwable) {
                // Don't propagate: the listener service must keep running
                // even if the JS bridge has gone away.
            }
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        UpiNotificationBus.onNotification = null
        promise.resolve(true)
    }

    /** Returns + clears notifications buffered while the JS layer was off. */
    @ReactMethod
    fun getBufferedNotifications(promise: Promise) {
        try {
            val arr = UpiNotificationStore.drain(reactCtx)
            promise.resolve(arr.toWritableArray())
        } catch (t: Throwable) {
            promise.reject("E_DRAIN", t)
        }
    }

    @ReactMethod
    fun getBufferedCount(promise: Promise) {
        promise.resolve(UpiNotificationStore.size(reactCtx))
    }

    /** Replace the package allow-list at runtime (e.g. user adds a regional
     *  app from Settings). */
    @ReactMethod
    fun setSupportedPackages(packages: ReadableArray, promise: Promise) {
        val out = mutableSetOf<String>()
        for (i in 0 until packages.size()) {
            packages.getString(i)?.let { out.add(it) }
        }
        UpiNotificationListenerService.supportedPackages = out
        promise.resolve(true)
    }

    /** NativeEventEmitter on the JS side calls these — we don't need to do
     *  anything but they must exist or RN logs warnings. */
    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) = Unit

    // ---------------------------------------------------------------
    // Helpers — Map<String, Any?> / JSONArray -> RN Writable* trees
    // ---------------------------------------------------------------

    private fun Map<String, Any?>.toWritableMap(): WritableMap {
        val map = Arguments.createMap()
        for ((k, v) in this) {
            putAny(map, k, v)
        }
        return map
    }

    private fun JSONArray.toWritableArray(): WritableArray {
        val out = Arguments.createArray()
        for (i in 0 until length()) {
            val obj = optJSONObject(i) ?: continue
            val map = Arguments.createMap()
            obj.keys().forEach { key ->
                val v = obj.opt(key)
                putAny(map, key, if (v === JSONObject.NULL) null else v)
            }
            out.pushMap(map)
        }
        return out
    }

    private fun putAny(map: WritableMap, key: String, v: Any?) {
        when (v) {
            null -> map.putNull(key)
            is String -> map.putString(key, v)
            is Boolean -> map.putBoolean(key, v)
            is Int -> map.putInt(key, v)
            is Long -> map.putDouble(key, v.toDouble())
            is Double -> map.putDouble(key, v)
            is Float -> map.putDouble(key, v.toDouble())
            else -> map.putString(key, v.toString())
        }
    }

    companion object {
        const val MODULE_NAME = "UpiNotificationModule"
        const val EVENT_NAME = "UpiNotification"
    }
}
