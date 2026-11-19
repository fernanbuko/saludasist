package expo.modules.saludasistalarm

import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import java.util.Locale

/** Elige una voz en español instalada en el teléfono: primero Latinoamérica, luego España; nunca una que necesite internet o no esté descargada. */
object SpanishVoice {
  private val order = listOf("US", "MX", "419", "CO", "AR", "PE", "CL", "ES")

  fun best(t: TextToSpeech): Voice? = try {
    t.voices?.filter {
      it.locale.language == "es" &&
        !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) &&
        !it.isNetworkConnectionRequired
    }?.minByOrNull { v -> order.indexOf(v.locale.country).let { if (it == -1) order.size - 1 else it } }
  } catch (_: Throwable) {
    null
  }

  /** Aplica la mejor voz; si no hay lista de voces, prueba idiomas. Devuelve false si no hay español. */
  fun apply(t: TextToSpeech): Boolean {
    best(t)?.let {
      t.voice = it
      return true
    }
    for (loc in listOf(Locale("es", "US"), Locale("es", "MX"), Locale("es", "ES"), Locale("es"))) {
      if (t.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) {
        t.language = loc
        return true
      }
    }
    return false
  }
}
