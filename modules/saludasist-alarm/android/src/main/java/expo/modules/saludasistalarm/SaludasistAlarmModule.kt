package expo.modules.saludasistalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Puente con JavaScript para programar las alarmas y revisar los permisos que necesitan. */
class SaludasistAlarmModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun open(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      ctx.startActivity(intent)
    } catch (_: Throwable) {
      ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  /** Abre la primera pantalla que exista; si ninguna, los ajustes de la app. */
  private fun openFirst(intents: List<Intent>) {
    for (i in intents) {
      try {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
        return
      } catch (_: Throwable) {}
    }
    open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
  }

  override fun definition() = ModuleDefinition {
    Name("SaludasistAlarm")

    Function("schedule") { id: String, atMs: Double, title: String, detail: String, time: String, speak: Boolean ->
      AlarmScheduler.schedule(ctx, id, atMs.toLong(), title, detail, time, speak)
    }

    Function("cancel") { id: String ->
      AlarmScheduler.cancel(ctx, id)
      AlarmScheduler.dismiss(ctx, id)
    }

    Function("cancelAll") {
      AlarmScheduler.cancelAll(ctx)
    }

    // Pantallas propias de Xiaomi (MIUI / HyperOS): sin "Inicio automático", el sistema borra las alarmas al cerrar la app.
    Function("openXiaomiAutostart") {
      val intents = listOf(
        Intent().setClassName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
        Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT),
      )
      openFirst(intents)
    }

    Function("openXiaomiBattery") {
      val intents = listOf(
        Intent().setClassName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
          .putExtra("package_name", ctx.packageName).putExtra("package_label", "SaludAsist"),
      )
      openFirst(intents)
    }

    Function("diagnostics") {
      AlarmScheduler.diagnostics(ctx)
    }

    Function("scheduledCount") {
      AlarmScheduler.ids(ctx).size
    }

    Function("test") { seconds: Int ->
      AlarmScheduler.schedule(ctx, "prueba", System.currentTimeMillis() + seconds * 1000L, "Alarma de prueba", "Así sonarán tus recordatorios", "", true)
    }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= 34) ctx.getSystemService(NotificationManager::class.java).canUseFullScreenIntent() else true
    }

    Function("canScheduleExactAlarms") {
      AlarmScheduler.canScheduleExact(ctx)
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.packageName)))
      } else {
        open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
      }
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= 31) {
        open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.packageName)))
      } else {
        open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
      }
    }
  }
}
