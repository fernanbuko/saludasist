package expo.modules.saludasistalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Servicio en primer plano con una notificación fija («SaludAsist activo · próxima toma …»).
 * Con él, el sistema casi nunca cierra la app ni le borra las alarmas, en cualquier marca de teléfono.
 * Si se cierra la app desde recientes, vuelve a asegurar las alarmas.
 */
class KeepAliveService : Service() {
  companion object {
    private const val CHANNEL = "saludasist_activo"
    private const val NOTIF_ID = 4242
    @Volatile var running = false

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("saludasist_alarms", Context.MODE_PRIVATE)
    fun enabled(ctx: Context) = prefs(ctx).getBoolean("keepAlive", true)
    fun setEnabled(ctx: Context, on: Boolean) {
      prefs(ctx).edit().putBoolean("keepAlive", on).commit()
      if (on) start(ctx) else stop(ctx)
    }

    /** Arranca el servicio (si está activado). Desde segundo plano Android puede no permitirlo: se ignora. */
    fun start(ctx: Context) {
      if (!enabled(ctx)) return
      try {
        val i = Intent(ctx, KeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
      } catch (e: Throwable) {
        if (!running) AlarmScheduler.log(ctx, "Modo activo no iniciado ahora (${e.javaClass.simpleName})")
      }
    }

    fun stop(ctx: Context) {
      try {
        ctx.stopService(Intent(ctx, KeepAliveService::class.java))
      } catch (_: Throwable) {}
      ctx.getSystemService(NotificationManager::class.java).cancel(NOTIF_ID)
    }

    /** Actualiza el texto de la notificación (próxima toma) o arranca el servicio si no estaba. */
    fun refresh(ctx: Context) {
      if (!enabled(ctx)) return
      if (running) {
        try {
          ctx.getSystemService(NotificationManager::class.java).notify(NOTIF_ID, build(ctx))
        } catch (_: Throwable) {}
      } else start(ctx)
    }

    private fun whenTxt(ms: Long): String {
      val c = Calendar.getInstance()
      val today = c.get(Calendar.DAY_OF_YEAR) to c.get(Calendar.YEAR)
      c.add(Calendar.DAY_OF_YEAR, 1)
      val tomorrow = c.get(Calendar.DAY_OF_YEAR) to c.get(Calendar.YEAR)
      c.timeInMillis = ms
      val day = c.get(Calendar.DAY_OF_YEAR) to c.get(Calendar.YEAR)
      val hm = SimpleDateFormat("HH:mm", Locale.US).format(ms)
      return when (day) {
        today -> "hoy a las $hm"
        tomorrow -> "mañana a las $hm"
        else -> SimpleDateFormat("dd/MM", Locale.US).format(ms) + " a las $hm"
      }
    }

    fun build(ctx: Context): Notification {
      val nm = ctx.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(
          NotificationChannel(CHANNEL, "SaludAsist activo", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Mantiene los recordatorios funcionando aunque cierres la app"
            setShowBadge(false)
            setSound(null, null)
          },
        )
      }
      val next = AlarmScheduler.nextAlarm(ctx)
      val text = next?.let { "Próxima toma: ${it.second}, ${whenTxt(it.first)}" } ?: "Los recordatorios de tus medicamentos están activos"
      val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
        PendingIntent.getActivity(ctx, NOTIF_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0))
      }
      @Suppress("DEPRECATION")
      val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx).setPriority(Notification.PRIORITY_LOW)
      val icon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_lock_idle_alarm
      b.setSmallIcon(icon)
        .setContentTitle("SaludAsist activo")
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(false)
        .setCategory(Notification.CATEGORY_SERVICE)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
      if (open != null) b.setContentIntent(open)
      if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
      return b.build()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val n = build(this)
      if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(NOTIF_ID, n)
      if (!running) AlarmScheduler.log(this, "Modo activo: notificación fija en marcha")
      running = true
    } catch (e: Throwable) {
      AlarmScheduler.log(this, "Modo activo no permitido ahora (${e.javaClass.simpleName})")
      stopSelf()
      return START_NOT_STICKY
    }
    if (!enabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // La app se cerró desde recientes: algunos teléfonos borran las alarmas en ese momento.
    AlarmScheduler.restoreAll(this, "app cerrada desde recientes")
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }
}
