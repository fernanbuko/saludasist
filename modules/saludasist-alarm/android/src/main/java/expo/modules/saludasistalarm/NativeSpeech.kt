package expo.modules.saludasistalarm

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener

/**
 * Voz de la app («Escuchar», asistente, avisos), como la de la alarma.
 * Si el motor de voz del teléfono se cerró en segundo plano (el canal queda roto y la voz no suena),
 * se abre uno nuevo y se vuelve a intentar.
 */
object NativeSpeech {
  private val main = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var ready = false
  private var lastParts: List<String> = emptyList()
  private var retried = false

  /** cb(resultado): "ok", "nospanish" (no hay voz en español) o "error". */
  fun speak(ctx: Context, parts: List<String>, cb: (String) -> Unit) {
    main.post {
      lastParts = parts
      retried = false
      val t = tts
      if (t != null && ready && say(t, parts)) {
        cb("ok")
        return@post
      }
      reset()
      create(ctx.applicationContext, parts, cb)
    }
  }

  fun stop() {
    main.post {
      try {
        tts?.stop()
      } catch (_: Throwable) {}
    }
  }

  private fun create(ctx: Context, parts: List<String>, cb: (String) -> Unit) {
    var created: TextToSpeech? = null
    var answered = false
    val answer = { r: String ->
      if (!answered) {
        answered = true
        cb(r)
      }
    }
    try {
      created = TextToSpeech(ctx) { status ->
        main.post {
          val t = created
          if (status != TextToSpeech.SUCCESS || t == null) {
            AlarmScheduler.log(ctx, "Voz: el motor de voz no arrancó")
            answer("error")
            return@post
          }
          if (!SpanishVoice.apply(t)) {
            AlarmScheduler.log(ctx, "Voz: no hay voz en español")
            try { t.shutdown() } catch (_: Throwable) {}
            answer("nospanish")
            return@post
          }
          t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) {}
            @Deprecated("Deprecated in Java")
            override fun onError(id: String?) {
              AlarmScheduler.log(ctx, "Voz: error al leer; se reinicia el motor")
              main.post {
                if (tts === t) reset()
                // Un reintento con un motor nuevo.
                if (!retried && lastParts.isNotEmpty()) {
                  retried = true
                  create(ctx, lastParts) {}
                }
              }
            }
          })
          tts = t
          ready = true
          answer(if (say(t, parts)) "ok" else "error")
        }
      }
      // Si el motor no responde en 6 s, no dejar la app esperando.
      main.postDelayed({ if (!answered) { AlarmScheduler.log(ctx, "Voz: el motor de voz no respondió"); answer("error") } }, 6000)
    } catch (e: Throwable) {
      AlarmScheduler.log(ctx, "Voz: ${e.javaClass.simpleName}")
      answer("error")
    }
  }

  private fun say(t: TextToSpeech, parts: List<String>): Boolean = try {
    t.stop()
    var ok = true
    parts.forEachIndexed { i, p ->
      if (t.speak(p, if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, "saludasist-$i") == TextToSpeech.ERROR) ok = false
    }
    ok
  } catch (_: Throwable) {
    false
  }

  private fun reset() {
    try {
      tts?.shutdown()
    } catch (_: Throwable) {}
    tts = null
    ready = false
  }
}
