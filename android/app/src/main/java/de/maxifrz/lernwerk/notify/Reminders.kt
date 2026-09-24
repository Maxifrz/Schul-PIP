package de.maxifrz.lernwerk.notify

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import de.maxifrz.lernwerk.MainActivity
import de.maxifrz.lernwerk.R
import de.maxifrz.lernwerk.data.AppData
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.plan.PlanReminder
import kotlinx.serialization.json.Json
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

/** The daily study plan reminder: one alarm per plan, renewed every time it fires and after a restart. */
object Reminders {
    private const val CHANNEL = "study-plan"
    private const val ACTION = "de.maxifrz.lernwerk.REMIND"
    private const val EXTRA_PLAN = "plan"

    /** The next time the clock shows [minuteOfDay], today if it is still ahead, otherwise tomorrow. */
    fun nextTrigger(minuteOfDay: Int, now: ZonedDateTime): ZonedDateTime {
        val time = LocalTime.of(minuteOfDay / 60 % 24, minuteOfDay % 60)
        val today = now.toLocalDate().atTime(time).atZone(now.zone)
        return if (today.isAfter(now)) today else today.plusDays(1)
    }

    fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Sets or cancels the plan's alarm to match its reminder time. */
    fun schedule(context: Context, plan: StudyPlan) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val minute = plan.reminderMinute
        if (minute == null || LocalDate.now().isAfter(plan.examDate)) {
            pendingIntent(context, plan.id, create = false)?.let(alarms::cancel)
            return
        }
        val trigger = nextTrigger(minute, ZonedDateTime.now()).toInstant().toEpochMilli()
        // Inexact but allowed in doze: a reminder a few minutes late is fine, a missing one is not.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent(context, plan.id, create = true)!!)
    }

    fun cancel(context: Context, planId: String) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        pendingIntent(context, planId, create = false)?.let(alarms::cancel)
    }

    fun scheduleAll(context: Context, plans: List<StudyPlan>) = plans.forEach { schedule(context, it) }

    private fun pendingIntent(context: Context, planId: String, create: Boolean): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java).setAction(ACTION).putExtra(EXTRA_PLAN, planId)
        val flags = PendingIntent.FLAG_IMMUTABLE or if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE
        return PendingIntent.getBroadcast(context, planId.hashCode(), intent, flags)
    }

    /** The plans as they are on disk; the receiver runs without the app's screens. */
    fun storedPlans(context: Context): List<StudyPlan> = runCatching {
        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
        }
        json.decodeFromString(AppData.serializer(), File(context.filesDir, "lernwerk.json").readText()).plans
    }.getOrDefault(emptyList())

    internal fun remind(context: Context, planId: String) {
        val plan = storedPlans(context).firstOrNull { it.id == planId } ?: return
        schedule(context, plan)
        val (title, text) = PlanReminder.message(plan, LocalDate.now()) ?: return
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(NotificationChannel(CHANNEL, "Lernplan-Erinnerung", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(planId.hashCode(), notification)
        } catch (denied: SecurityException) {
            // The permission was withdrawn after the check.
        }
    }

    internal const val ACTION_REMIND = ACTION
    internal const val PLAN = EXTRA_PLAN
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Reminders.ACTION_REMIND -> intent.getStringExtra(Reminders.PLAN)?.let { Reminders.remind(context, it) }
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIMEZONE_CHANGED ->
                Reminders.scheduleAll(context, Reminders.storedPlans(context))
        }
    }
}
