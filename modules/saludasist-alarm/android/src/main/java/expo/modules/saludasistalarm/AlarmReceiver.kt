package expo.modules.saludasistalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/** Recibe la alarma programada (mostrarla) y el botón "Posponer" de la notificación. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: ""
    val detail = intent.getStringExtra(AlarmScheduler.EXTRA_DETAIL) ?: ""
    val time = intent.getStringExtra(AlarmScheduler.EXTRA_TIME) ?: ""
    val speak = intent.getBooleanExtra(AlarmScheduler.EXTRA_SPEAK, true)
    AlarmScheduler.log(ctx, "Recibida la hora de la alarma: $title")
    when (intent.action) {
      AlarmScheduler.ACTION_FIRE -> {
        val at = intent.getLongExtra(AlarmScheduler.EXTRA_AT, 0L)
        if (!AlarmScheduler.alreadyShown(ctx, id, at)) AlarmScheduler.recordLate(ctx, id, title, at)
        AlarmScheduler.showAlarm(ctx, id, title, detail, time, speak, at)
      }
      AlarmScheduler.ACTION_SNOOZE -> {
        AlarmScheduler.snooze(ctx, id, title, detail, time, speak)
        Toast.makeText(ctx, "Te lo recuerdo en ${AlarmScheduler.SNOOZE_MIN} minutos", Toast.LENGTH_LONG).show()
      }
    }
  }
}
