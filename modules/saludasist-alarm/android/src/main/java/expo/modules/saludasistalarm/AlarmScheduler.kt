package expo.modules.saludasistalarm

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Programa y muestra las alarmas de toma:
 *  - AlarmManager.setAlarmClock: suena a la hora exacta aunque el teléfono esté en reposo;
 *  - al sonar, una notificación de categoría alarma con pantalla completa (AlarmActivity),
 *    sonido de alarma que se repite (FLAG_INSISTENT) y vibración, hasta que se pulsa un botón.
 */
object AlarmScheduler {
  const val CHANNEL = "alarma_medicamento"
  private const val PREFS = "saludasist_alarms"

  const val ACTION_FIRE = "expo.modules.saludasistalarm.FIRE"
  const val ACTION_SNOOZE = "expo.modules.saludasistalarm.SNOOZE"
  const val EXTRA_ID = "id"
  const val EXTRA_TITLE = "title"
  const val EXTRA_DETAIL = "detail"
  const val EXTRA_TIME = "time"
  const val EXTRA_SPEAK = "speak"
  const val EXTRA_DO = "do"
  const val SNOOZE_MIN = 10
  private const val RING_LIMIT_MS = 10 * 60 * 1000L

  private fun rc(id: String) = id.hashCode()
  private fun immutable() = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Registro de las últimas acciones de la alarma, para diagnosticar en Ajustes si no suena. */
  fun log(ctx: Context, msg: String) {
    try {
      val line = SimpleDateFormat("dd/MM HH:mm:ss", Locale.US).format(Date()) + "  " + msg
      val old = prefs(ctx).getString("log", "") ?: ""
      val lines = (listOf(line) + old.split("\n").filter { it.isNotBlank() }).take(25)
      prefs(ctx).edit().putString("log", lines.joinToString("\n")).commit()
    } catch (_: Throwable) {}
  }

  fun diagnostics(ctx: Context): String = prefs(ctx).getString("log", "") ?: ""

  private fun hhmm(ms: Long) = SimpleDateFormat("dd/MM HH:mm", Locale.US).format(Date(ms))
  fun ids(ctx: Context): Set<String> = prefs(ctx).getStringSet("ids", emptySet()) ?: emptySet()
  private fun setIds(ctx: Context, ids: Set<String>) = prefs(ctx).edit().putStringSet("ids", HashSet(ids)).apply()

  private fun fireIntent(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_DETAIL, detail)
      putExtra(EXTRA_TIME, time)
      putExtra(EXTRA_SPEAK, speak)
    }
    return PendingIntent.getBroadcast(ctx, rc(id), i, PendingIntent.FLAG_UPDATE_CURRENT or immutable())
  }

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < 31) return true
    return ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  fun schedule(ctx: Context, id: String, atMs: Long, title: String, detail: String, time: String, speak: Boolean) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val fire = fireIntent(ctx, id, title, detail, time, speak)
    log(ctx, "Programada: $title para ${hhmm(atMs)}" + if (canScheduleExact(ctx)) " (exacta)" else " (aproximada)")
    if (canScheduleExact(ctx)) {
      val show = PendingIntent.getActivity(ctx, rc(id), alarmActivityIntent(ctx, id, title, detail, time, speak), PendingIntent.FLAG_UPDATE_CURRENT or immutable())
      am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, show), fire)
    } else if (Build.VERSION.SDK_INT >= 23) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, fire)
    } else {
      am.set(AlarmManager.RTC_WAKEUP, atMs, fire)
    }
    setIds(ctx, ids(ctx) + id)
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    am.cancel(fireIntent(ctx, id, "", "", "", false))
    setIds(ctx, ids(ctx) - id)
  }

  fun cancelAll(ctx: Context) {
    if (ids(ctx).isNotEmpty()) log(ctx, "Reprogramando: se quitan ${ids(ctx).size} alarmas anteriores")
    for (id in ids(ctx)) {
      ctx.getSystemService(AlarmManager::class.java).cancel(fireIntent(ctx, id, "", "", "", false))
    }
    setIds(ctx, emptySet())
  }

  fun alarmActivityIntent(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean, todo: String? = null) =
    Intent(ctx, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_DETAIL, detail)
      putExtra(EXTRA_TIME, time)
      putExtra(EXTRA_SPEAK, speak)
      if (todo != null) putExtra(EXTRA_DO, todo)
    }

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Alarma de medicamentos", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Alarma a pantalla completa a la hora de cada toma"
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
      )
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(ch)
  }

  private fun smallIcon(ctx: Context): Int {
    val res = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (res != 0) res else android.R.drawable.ic_lock_idle_alarm
  }

  /** Muestra la alarma: pantalla completa si el sistema lo permite; si no, notificación insistente. */
  fun showAlarm(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean) {
    setIds(ctx, ids(ctx) - id)
    try {
      showAlarmInner(ctx, id, title, detail, time, speak)
      log(ctx, "Sonando: $title")
    } catch (e: Throwable) {
      log(ctx, "ERROR al mostrar: ${e.javaClass.simpleName}: ${e.message}")
      // Respaldo: notificación sencilla con sonido de alarma, sin pantalla completa.
      try {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx)
        b.setSmallIcon(smallIcon(ctx)).setContentTitle("Hora de tu medicamento: $title").setContentText(detail).setAutoCancel(true)
          .setContentIntent(ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let { PendingIntent.getActivity(ctx, rc(id) + 3, it, immutable()) })
        nm.notify(rc(id), b.build())
        log(ctx, "Mostrada como notificación sencilla")
      } catch (e2: Throwable) {
        log(ctx, "ERROR también en el respaldo: ${e2.message}")
      }
    }
  }

  private fun showAlarmInner(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean) {
    ensureChannel(ctx)
    if (Build.VERSION.SDK_INT >= 24 && !ctx.getSystemService(NotificationManager::class.java).areNotificationsEnabled()) log(ctx, "AVISO: las notificaciones de la app están desactivadas")
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val full = PendingIntent.getActivity(ctx, rc(id), alarmActivityIntent(ctx, id, title, detail, time, speak), PendingIntent.FLAG_UPDATE_CURRENT or immutable())
    val taken = PendingIntent.getActivity(ctx, rc(id) + 1, alarmActivityIntent(ctx, id, title, detail, time, speak, "taken"), PendingIntent.FLAG_UPDATE_CURRENT or immutable())
    val snooze = PendingIntent.getBroadcast(
      ctx,
      rc(id) + 2,
      Intent(ctx, AlarmReceiver::class.java).apply {
        action = ACTION_SNOOZE
        putExtra(EXTRA_ID, id)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_DETAIL, detail)
        putExtra(EXTRA_TIME, time)
        putExtra(EXTRA_SPEAK, speak)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or immutable(),
    )
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx).setPriority(Notification.PRIORITY_MAX)
    b.setSmallIcon(smallIcon(ctx))
      .setContentTitle("Hora de tu medicamento: $title")
      .setContentText(listOf(time, detail).filter { it.isNotBlank() }.joinToString(" · "))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setFullScreenIntent(full, true)
      .setContentIntent(full)
      .setOngoing(true)
      .setAutoCancel(false)
      .addAction(Notification.Action.Builder(null, "Ya la tomé", taken).build())
      .addAction(Notification.Action.Builder(null, "Posponer $SNOOZE_MIN min", snooze).build())
    if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(RING_LIMIT_MS)
    val n = b.build()
    n.flags = n.flags or Notification.FLAG_INSISTENT
    nm.notify(rc(id), n)
  }

  fun dismiss(ctx: Context, id: String) {
    ctx.getSystemService(NotificationManager::class.java).cancel(rc(id))
  }

  fun snooze(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean) {
    dismiss(ctx, id)
    schedule(ctx, id, System.currentTimeMillis() + SNOOZE_MIN * 60_000L, title, detail, time, speak)
  }

  /** Abre SaludAsist en la verificación con foto de esta toma. */
  fun openTaken(ctx: Context, id: String) {
    dismiss(ctx, id)
    val i = Intent(Intent.ACTION_VIEW, Uri.parse("saludasist://validar?key=" + Uri.encode(id))).apply {
      setPackage(ctx.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try {
      ctx.startActivity(i)
    } catch (_: Throwable) {
      ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(it)
      }
    }
  }
}
