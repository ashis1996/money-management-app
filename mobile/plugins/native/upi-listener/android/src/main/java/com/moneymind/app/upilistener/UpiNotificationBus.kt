package com.moneymind.app.upilistener

/**
 * In-process callback bridge between the OS-managed
 * [UpiNotificationListenerService] and the React-Native bridge module.
 *
 * The service runs in the same Android process as the rest of the app, so a
 * plain `object` with a volatile callback is sufficient — we don't need
 * cross-process IPC. The module sets [onNotification] in its `start()`
 * method and clears it in `stop()`. The service invokes it on every
 * captured UPI notification.
 *
 * Notifications captured while the JS layer is dead are still persisted
 * to disk via [UpiNotificationStore]; the bus only carries the live ones.
 */
object UpiNotificationBus {
    @Volatile
    var onNotification: ((data: Map<String, Any?>) -> Unit)? = null
}
