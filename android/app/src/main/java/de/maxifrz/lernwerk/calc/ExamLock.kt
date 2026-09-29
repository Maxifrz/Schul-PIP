package de.maxifrz.lernwerk.calc

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * The calculator's exam mode, as the app sees it: while it runs, only the calculator tab is open and nothing can
 * be shared into the app. The calculator page starts and ends it; the flag survives a restart of the app.
 */
object ExamLock {
    private const val PREFS = "exam"
    private const val KEY = "active"

    var active by mutableStateOf(false)
        private set

    fun load(context: Context) {
        active = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY, false)
    }

    fun set(context: Context, value: Boolean) {
        active = value
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY, value).apply()
    }
}
