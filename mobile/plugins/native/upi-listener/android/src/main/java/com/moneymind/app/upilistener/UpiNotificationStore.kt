package com.moneymind.app.upilistener

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Disk-backed FIFO buffer for UPI notifications captured while the JS
 * layer is not running. The module drains the buffer when the user
 * foregrounds the app so we don't lose payments that happened in the
 * background.
 *
 * Backed by SharedPreferences (a single JSON-encoded array). We cap the
 * buffer to [MAX_ENTRIES] to avoid unbounded growth if the user goes
 * weeks without opening the app.
 */
internal object UpiNotificationStore {
    private const val TAG = "UpiNotificationStore"
    private const val PREFS = "upi_notification_listener"
    private const val BUFFER_KEY = "buffer"
    private const val MAX_ENTRIES = 200

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Append a captured notification to the buffer. Trims the oldest entries
     *  if the buffer would exceed [MAX_ENTRIES]. Failures are logged and
     *  swallowed — losing one notification is better than crashing the
     *  privileged listener service. */
    fun append(context: Context, payload: Map<String, Any?>) {
        try {
            val current = JSONArray(prefs(context).getString(BUFFER_KEY, "[]"))
            val entry = JSONObject()
            for ((k, v) in payload) {
                entry.put(k, v ?: JSONObject.NULL)
            }
            current.put(entry)

            val trimmed = if (current.length() > MAX_ENTRIES) {
                val out = JSONArray()
                for (i in current.length() - MAX_ENTRIES until current.length()) {
                    out.put(current.get(i))
                }
                out
            } else {
                current
            }

            prefs(context).edit()
                .putString(BUFFER_KEY, trimmed.toString())
                .apply()
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to append notification to buffer", t)
        }
    }

    /** Read all buffered notifications and clear the buffer. Returns an
     *  empty array if nothing is buffered or the data is corrupt. */
    fun drain(context: Context): JSONArray {
        val raw = prefs(context).getString(BUFFER_KEY, "[]") ?: "[]"
        prefs(context).edit().remove(BUFFER_KEY).apply()
        return try {
            JSONArray(raw)
        } catch (t: Throwable) {
            Log.w(TAG, "Buffer was corrupt; returning empty", t)
            JSONArray()
        }
    }

    /** Number of currently buffered entries (without draining). */
    fun size(context: Context): Int = try {
        JSONArray(prefs(context).getString(BUFFER_KEY, "[]")).length()
    } catch (t: Throwable) {
        0
    }
}
