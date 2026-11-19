package expo.modules.saludasistalarm

import android.app.Activity
import android.os.Bundle

/**
 * Segunda vía de la alarma: el sistema abre esta actividad invisible unos segundos después de la hora.
 * Si la alarma ya sonó por la vía normal, se cierra sin hacer nada; si no (teléfonos que retienen
 * los avisos a la app cerrada), la hace sonar y abre la pantalla de la alarma.
 */
class AlarmTrampoline : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      val i = intent
      val id = i.getStringExtra(AlarmScheduler.EXTRA_ID)
      val at = i.getLongExtra(AlarmScheduler.EXTRA_AT, 0L)
      if (id != null && !AlarmScheduler.alreadyShown(this, id, at)) {
        val title = i.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: ""
        val detail = i.getStringExtra(AlarmScheduler.EXTRA_DETAIL) ?: ""
        val time = i.getStringExtra(AlarmScheduler.EXTRA_TIME) ?: ""
        val speak = i.getBooleanExtra(AlarmScheduler.EXTRA_SPEAK, true)
        AlarmScheduler.log(this, "Vía directa: la alarma no había llegado, se muestra ahora ($title)")
        AlarmScheduler.recordLate(this, id, title, at)
        AlarmScheduler.showAlarm(this, id, title, detail, time, speak, at)
        startActivity(AlarmScheduler.alarmActivityIntent(this, id, title, detail, time, speak))
      }
    } catch (e: Throwable) {
      AlarmScheduler.log(this, "ERROR en la vía directa: ${e.javaClass.simpleName}")
    }
    finish()
  }
}
