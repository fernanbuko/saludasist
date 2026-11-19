package expo.modules.saludasistalarm

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.Locale

/**
 * Pantalla de alarma: aparece sobre la pantalla de bloqueo y enciende el teléfono.
 * El sonido lo pone la notificación insistente; se detiene al pulsar "Ya la tomé" o "Posponer".
 */
class AlarmActivity : Activity() {
  private var tts: TextToSpeech? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: run { finish(); return }
    val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: ""
    val detail = intent.getStringExtra(AlarmScheduler.EXTRA_DETAIL) ?: ""
    val time = intent.getStringExtra(AlarmScheduler.EXTRA_TIME) ?: ""
    val speak = intent.getBooleanExtra(AlarmScheduler.EXTRA_SPEAK, true)
    AlarmScheduler.log(this, "Pantalla de alarma abierta: $title")

    // Botón "Ya la tomé" de la notificación: abrir directamente la verificación.
    if (intent.getStringExtra(AlarmScheduler.EXTRA_DO) == "taken") {
      AlarmScheduler.openTaken(this, id)
      finish()
      return
    }

    val dp = resources.displayMetrics.density
    fun px(v: Int) = (v * dp).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(px(24), px(56), px(24), px(32))
      setBackgroundColor(Color.parseColor("#3A6EA5"))
    }
    fun text(t: String, size: Float, bold: Boolean = false, color: String = "#FFFFFF", top: Int = 0) =
      TextView(this).apply {
        text = t
        textSize = size
        setTextColor(Color.parseColor(color))
        gravity = Gravity.CENTER
        if (bold) setTypeface(typeface, Typeface.BOLD)
        setPadding(0, px(top), 0, 0)
      }
    root.addView(text("SaludAsist", 18f, true, "#D7E7F7"))
    root.addView(text(time, 72f, true, top = 24))
    root.addView(text("Hora de tu medicamento", 22f, false, "#E9F1FA", 8))
    root.addView(text(title, 34f, true, top = 20))
    if (detail.isNotBlank()) root.addView(text(detail, 20f, false, "#E9F1FA", 8))

    val spacer = LinearLayout(this)
    root.addView(spacer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

    fun bigButton(label: String, bg: String, fg: String, onClick: () -> Unit) =
      Button(this).apply {
        text = label
        textSize = 22f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.parseColor(fg))
        isAllCaps = true
        background = GradientDrawable().apply {
          cornerRadius = px(18).toFloat()
          setColor(Color.parseColor(bg))
        }
        setPadding(0, px(22), 0, px(22))
        setOnClickListener { onClick() }
      }
    val lp = { LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(14) } }
    root.addView(
      bigButton("Ya la tomé", "#3E9B4F", "#FFFFFF") {
        AlarmScheduler.openTaken(this, id)
        finish()
      },
      lp(),
    )
    root.addView(
      bigButton("Posponer ${AlarmScheduler.SNOOZE_MIN} min", "#FFFFFF", "#2B5687") {
        AlarmScheduler.snooze(this, id, title, detail, time, speak)
        Toast.makeText(this, "Te lo recuerdo en ${AlarmScheduler.SNOOZE_MIN} minutos", Toast.LENGTH_LONG).show()
        finish()
      },
      lp(),
    )
    setContentView(root)

    if (speak) {
      tts = TextToSpeech(this) { status ->
        if (status == TextToSpeech.SUCCESS) {
          spanish(tts!!)
          Handler(Looper.getMainLooper()).postDelayed({
            tts?.speak("Es hora de tu medicamento: $title. $detail", TextToSpeech.QUEUE_FLUSH, null, "alarma")
          }, 1500)
        }
      }
    }
  }

  /**
   * Elige una voz en español instalada en el teléfono (primero Latinoamérica, luego España).
   * Pedir siempre «es-ES» dejaba la alarma muda en teléfonos que solo tienen otra variante.
   */
  private fun spanish(t: TextToSpeech) {
    val order = listOf("US", "MX", "419", "CO", "AR", "PE", "CL", "ES")
    try {
      val voices = t.voices?.filter {
        it.locale.language == "es" &&
          !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) &&
          !it.isNetworkConnectionRequired
      }.orEmpty()
      val best = voices.minByOrNull { v -> order.indexOf(v.locale.country).let { if (it == -1) order.size - 1 else it } }
      if (best != null) {
        t.voice = best
        return
      }
    } catch (_: Throwable) {}
    for (loc in listOf(Locale("es", "US"), Locale("es", "MX"), Locale("es", "ES"), Locale("es"))) {
      if (t.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) {
        t.language = loc
        return
      }
    }
    AlarmScheduler.log(this, "Sin voz en español en este teléfono")
  }

  override fun onDestroy() {
    tts?.stop()
    tts?.shutdown()
    super.onDestroy()
  }
}
