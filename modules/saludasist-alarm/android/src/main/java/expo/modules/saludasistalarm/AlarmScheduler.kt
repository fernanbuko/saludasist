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
import org.json.JSONObject

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
  const val EXTRA_AT = "at"
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
      val lines = (listOf(line) + old.split("\n").filter { it.isNotBlank() }).take(40)
      prefs(ctx).edit().putString("log", lines.joinToString("\n")).commit()
    } catch (_: Throwable) {}
  }

  /** La próxima alarma pendiente: (hora, nombre del medicamento). */
  fun nextAlarm(ctx: Context): Pair<Long, String>? {
    val now = System.currentTimeMillis()
    var next: Pair<Long, String>? = null
    for (id in ids(ctx).toList()) {
      if (id == "prueba") continue
      val raw = prefs(ctx).getString("a:$id", null) ?: continue
      try {
        val j = JSONObject(raw)
        val at = j.getLong("at")
        if (at > now && (next == null || at < next.first)) next = at to j.optString("title")
      } catch (_: Throwable) {}
    }
    return next
  }

  private const val GRACE_MS = 3 * 60 * 1000L

  /**
   * Una alarma cuya hora ya pasó y que sigue pendiente nunca llegó a sonar: el sistema cerró la app
   * o borró la alarma. Se guarda para avisar al abrir la app.
   */
  private fun recordMissed(ctx: Context, id: String, reason: String) {
    val raw = prefs(ctx).getString("a:$id", null) ?: return
    try {
      val j = JSONObject(raw)
      val at = j.getLong("at")
      val now = System.currentTimeMillis()
      if (at > now - GRACE_MS || at < now - 3 * 24 * 3600 * 1000L) return
      val list = try { org.json.JSONArray(prefs(ctx).getString("missed", "[]")) } catch (_: Throwable) { org.json.JSONArray() }
      list.put(JSONObject().put("id", id).put("title", j.optString("title")).put("at", at).put("reason", reason))
      while (list.length() > 20) list.remove(0)
      prefs(ctx).edit().putString("missed", list.toString()).commit()
      log(ctx, "NO SONÓ: ${j.optString("title")} de las ${hhmm(at)} ($reason)")
    } catch (_: Throwable) {}
  }

  /** La alarma llegó con retraso (el sistema retuvo la app): se registra para avisar al abrir la app. */
  fun recordLate(ctx: Context, id: String, title: String, atMs: Long) {
    val lateMs = System.currentTimeMillis() - atMs
    if (atMs <= 0L || lateMs < 40_000L || id == "prueba") return
    val min = maxOf(1L, (lateMs + 30_000L) / 60_000L)
    log(ctx, "LLEGÓ TARDE ($min min): $title de las ${hhmm(atMs)}")
    try {
      val list = try { org.json.JSONArray(prefs(ctx).getString("missed", "[]")) } catch (_: Throwable) { org.json.JSONArray() }
      list.put(JSONObject().put("id", id).put("title", title).put("at", atMs).put("reason", "sonó $min min tarde"))
      while (list.length() > 20) list.remove(0)
      prefs(ctx).edit().putString("missed", list.toString()).commit()
    } catch (_: Throwable) {}
  }

  fun missed(ctx: Context): String = prefs(ctx).getString("missed", "[]") ?: "[]"
  fun clearMissed(ctx: Context) = prefs(ctx).edit().remove("missed").commit()

  /** Resumen tras reprogramar: cuántas alarmas quedan y cuál es la próxima. */
  fun logSummary(ctx: Context) {
    val next = nextAlarm(ctx)
    KeepAliveService.refresh(ctx)
    val n = ids(ctx).size
    log(ctx, "Programadas $n alarmas" + (next?.let { " · próxima: ${it.second} el ${hhmm(it.first)}" } ?: "") + if (canScheduleExact(ctx)) "" else " (sin permiso de alarma exacta)")
  }

  fun diagnostics(ctx: Context): String = prefs(ctx).getString("log", "") ?: ""

  private fun hhmm(ms: Long) = SimpleDateFormat("dd/MM HH:mm", Locale.US).format(Date(ms))
  fun ids(ctx: Context): Set<String> = prefs(ctx).getStringSet("ids", emptySet()) ?: emptySet()
  private fun setIds(ctx: Context, ids: Set<String>) = prefs(ctx).edit().putStringSet("ids", HashSet(ids)).apply()

  /** Datos de cada alarma pendiente, para volver a programarla si el teléfono se reinicia. */
  private fun saveData(ctx: Context, id: String, atMs: Long, title: String, detail: String, time: String, speak: Boolean) {
    val j = JSONObject().put("at", atMs).put("title", title).put("detail", detail).put("time", time).put("speak", speak)
    prefs(ctx).edit().putString("a:$id", j.toString()).apply()
  }
  private fun dropData(ctx: Context, id: String) = prefs(ctx).edit().remove("a:$id").apply()

  /**
   * Tras reiniciar el teléfono, cambiar la hora o actualizar la app, Android borra las alarmas:
   * se vuelven a programar desde lo guardado. Las que vencieron hace poco (teléfono apagado) suenan ya.
   */
  fun restoreAll(ctx: Context, reason: String) {
    val now = System.currentTimeMillis()
    var n = 0
    for (id in ids(ctx).toList()) {
      val raw = prefs(ctx).getString("a:$id", null) ?: continue
      try {
        val j = JSONObject(raw)
        val at = j.getLong("at")
        val title = j.optString("title"); val detail = j.optString("detail"); val time = j.optString("time"); val speak = j.optBoolean("speak", true)
        when {
          at > now -> { schedule(ctx, id, at, title, detail, time, speak, quiet = true); n++ }
          now - at < 60 * 60 * 1000L -> showAlarm(ctx, id, title, detail, time, speak, at)
          else -> { recordMissed(ctx, id, if (reason == "teléfono reiniciado") "el teléfono estaba apagado" else "el sistema la borró"); setIds(ctx, ids(ctx) - id); dropData(ctx, id) }
        }
      } catch (_: Throwable) {}
    }
    log(ctx, "Reprogramadas $n alarmas ($reason)")
    KeepAliveService.refresh(ctx)
  }

  private fun fireIntent(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean, atMs: Long = 0L): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_AT, atMs)
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_DETAIL, detail)
      putExtra(EXTRA_TIME, time)
      putExtra(EXTRA_SPEAK, speak)
    }
    return PendingIntent.getBroadcast(ctx, rc(id), i, PendingIntent.FLAG_UPDATE_CURRENT or immutable())
  }

  /** Segunda vía: el sistema abre directamente la pantalla de la alarma (para teléfonos que retienen los avisos a la app). */
  private const val DIRECT_DELAY_MS = 5_000L

  private fun directIntent(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean, atMs: Long): PendingIntent {
    val i = Intent(ctx, AlarmTrampoline::class.java).apply {
      action = "expo.modules.saludasistalarm.DIRECT"
      data = Uri.parse("saludasist-alarm://" + Uri.encode(id))
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_DETAIL, detail)
      putExtra(EXTRA_TIME, time)
      putExtra(EXTRA_SPEAK, speak)
      putExtra(EXTRA_AT, atMs)
    }
    return PendingIntent.getActivity(ctx, rc(id) + 5, i, PendingIntent.FLAG_UPDATE_CURRENT or immutable())
  }

  /** ¿Ya se mostró la alarma de esta toma a esta hora? Evita que suene dos veces (una por cada vía). */
  fun alreadyShown(ctx: Context, id: String, atMs: Long) = atMs > 0L && prefs(ctx).getLong("shown:$id", 0L) == atMs
  private fun markShown(ctx: Context, id: String, atMs: Long) {
    if (atMs > 0L) prefs(ctx).edit().putLong("shown:$id", atMs).commit()
  }

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < 31) return true
    return ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  fun schedule(ctx: Context, id: String, atMs: Long, title: String, detail: String, time: String, speak: Boolean, quiet: Boolean = false) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val fire = fireIntent(ctx, id, title, detail, time, speak, atMs)
    if (!quiet) log(ctx, "Programada: $title para ${hhmm(atMs)}" + if (canScheduleExact(ctx)) " (exacta)" else " (aproximada)")
    if (canScheduleExact(ctx)) {
      val show = PendingIntent.getActivity(ctx, rc(id), alarmActivityIntent(ctx, id, title, detail, time, speak), PendingIntent.FLAG_UPDATE_CURRENT or immutable())
      am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, show), fire)
      try {
        am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs + DIRECT_DELAY_MS, show), directIntent(ctx, id, title, detail, time, speak, atMs))
      } catch (_: Throwable) {}
    } else if (Build.VERSION.SDK_INT >= 23) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, fire)
    } else {
      am.set(AlarmManager.RTC_WAKEUP, atMs, fire)
    }
    saveData(ctx, id, atMs, title, detail, time, speak)
    setIds(ctx, ids(ctx) + id)
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    am.cancel(fireIntent(ctx, id, "", "", "", false))
    am.cancel(directIntent(ctx, id, "", "", "", false, 0L))
    setIds(ctx, ids(ctx) - id)
    dropData(ctx, id)
  }

  fun cancelAll(ctx: Context) {
    if (ids(ctx).isNotEmpty()) log(ctx, "Reprogramando: se quitan ${ids(ctx).size} alarmas anteriores")
    for (id in ids(ctx).toList()) {
      ctx.getSystemService(AlarmManager::class.java).cancel(fireIntent(ctx, id, "", "", "", false))
      ctx.getSystemService(AlarmManager::class.java).cancel(directIntent(ctx, id, "", "", "", false, 0L))
      recordMissed(ctx, id, "el teléfono cerró la app")
      dropData(ctx, id)
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
  fun showAlarm(ctx: Context, id: String, title: String, detail: String, time: String, speak: Boolean, atMs: Long = 0L) {
    if (alreadyShown(ctx, id, atMs)) {
      log(ctx, "Ya mostrada por la otra vía: $title")
      return
    }
    markShown(ctx, id, atMs)
    setIds(ctx, ids(ctx) - id)
    dropData(ctx, id)
    try {
      showAlarmInner(ctx, id, title, detail, time, speak)
      log(ctx, "Sonando: $title")
      KeepAliveService.refresh(ctx)
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
