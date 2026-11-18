package expo.modules.saludasistalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Vuelve a programar las alarmas tras reiniciar el teléfono, cambiar la hora o actualizar la app. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val reason = when (intent.action) {
      Intent.ACTION_MY_PACKAGE_REPLACED -> "app actualizada"
      Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> "cambio de hora"
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> "permiso de alarmas"
      else -> "teléfono reiniciado"
    }
    val pending = goAsync()
    Thread {
      try {
        AlarmScheduler.restoreAll(ctx, reason)
        KeepAliveService.start(ctx)
      } finally {
        pending.finish()
      }
    }.start()
  }
}
