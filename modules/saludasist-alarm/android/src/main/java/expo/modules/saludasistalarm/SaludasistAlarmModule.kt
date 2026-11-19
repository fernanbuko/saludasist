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

  /** Abre la primera pantalla que exista; devuelve false si no existe ninguna. */
  private fun tryOpen(intents: List<Intent>): Boolean {
    for (i in intents) {
      try {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
        return true
      } catch (_: Throwable) {}
    }
    return false
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

  /** Botones de la barra de navegación del sistema: oscuros con la app en modo claro, claros en modo oscuro. */
  @Volatile private var darkButtons = true

  private fun darkNavButtons() {
    val dark = darkButtons
    val a = appContext.currentActivity ?: return
    a.runOnUiThread {
      try {
        val w = a.window
        if (Build.VERSION.SDK_INT >= 30) {
          w.insetsController?.setSystemBarsAppearance(
            if (dark) android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS else 0,
            android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
          )
        } else if (Build.VERSION.SDK_INT >= 26) {
          val f = android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
          @Suppress("DEPRECATION")
          w.decorView.systemUiVisibility = if (dark) w.decorView.systemUiVisibility or f else w.decorView.systemUiVisibility and f.inv()
        }
      } catch (_: Throwable) {}
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SaludasistAlarm")

    OnActivityEntersForeground {
      darkNavButtons()
    }

    Function("darkNavButtons") {
      darkNavButtons()
    }

    Function("setNavButtonsDark") { dark: Boolean ->
      darkButtons = dark
      darkNavButtons()
    }

    Function("schedule") { id: String, atMs: Double, title: String, detail: String, time: String, speak: Boolean ->
      AlarmScheduler.schedule(ctx, id, atMs.toLong(), title, detail, time, speak, quiet = true)
    }

    Function("logSummary") {
      AlarmScheduler.logSummary(ctx)
    }

    Function("cancel") { id: String ->
      AlarmScheduler.cancel(ctx, id)
      AlarmScheduler.dismiss(ctx, id)
    }

    Function("cancelAll") {
      AlarmScheduler.cancelAll(ctx)
    }

    Function("manufacturer") {
      (Build.MANUFACTURER ?: "").lowercase() + " " + (Build.BRAND ?: "").lowercase()
    }

    // Pantalla de «Inicio automático» / apps protegidas del fabricante. Devuelve false si este teléfono no tiene ninguna.
    Function("openAutostart") {
      tryOpen(Oem.autostartIntents())
    }

    Function("hasAutostart") {
      Oem.autostartIntents().isNotEmpty()
    }

    // Ajustes de batería de la app (pantalla del fabricante si existe; si no, la información de la app).
    Function("openBatterySettings") {
      openFirst(Oem.batteryIntents(ctx.packageName))
    }

    Function("isIgnoringBatteryOptimizations") {
      if (Build.VERSION.SDK_INT >= 23) ctx.getSystemService(android.os.PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName) else true
    }

    // Ventana del sistema: «¿Permitir que SaludAsist se ejecute siempre en segundo plano?»
    Function("requestIgnoreBatteryOptimizations") {
      if (Build.VERSION.SDK_INT >= 23) {
        openFirst(
          listOf(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.packageName)),
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
          ),
        )
      }
    }

    Function("setKeepAlive") { on: Boolean ->
      KeepAliveService.setEnabled(ctx, on)
    }

    Function("keepAliveOn") {
      KeepAliveService.enabled(ctx)
    }

    Function("startKeepAlive") {
      KeepAliveService.refresh(ctx)
    }

    Function("stopKeepAlive") {
      KeepAliveService.stop(ctx)
    }

    // Nombre de la mejor voz en español instalada ("" si el teléfono no tiene ninguna).
    AsyncFunction("spanishVoice") { promise: expo.modules.kotlin.Promise ->
      var tts: android.speech.tts.TextToSpeech? = null
      var done = false
      val finish = { result: String? ->
        if (!done) {
          done = true
          try { tts?.shutdown() } catch (_: Throwable) {}
          if (result == null) promise.reject("TTS", "No se pudo iniciar la voz", null) else promise.resolve(result)
        }
      }
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        try {
          tts = android.speech.tts.TextToSpeech(ctx) { status ->
            if (status != android.speech.tts.TextToSpeech.SUCCESS) finish(null)
            else finish(SpanishVoice.best(tts!!)?.name ?: "")
          }
          android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ finish(null) }, 6000)
        } catch (_: Throwable) {
          finish(null)
        }
      }
    }

    Function("missedAlarms") {
      AlarmScheduler.missed(ctx)
    }

    Function("clearMissed") {
      AlarmScheduler.clearMissed(ctx)
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
