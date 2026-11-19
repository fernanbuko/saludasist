import { Alert, Linking, Platform } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * Voz en español: se usa la que tenga el teléfono instalada (primero Latinoamérica, luego España).
 * Antes se pedía siempre «español de España» y en teléfonos que solo tienen otra variante la app se quedaba muda.
 */
const ORDER = ['es-us', 'es-mx', 'es-419', 'es-co', 'es-ar', 'es-pe', 'es-cl', 'es-es'];

let chosen: { voice?: string } | null | undefined;

async function pick(): Promise<{ voice?: string } | null> {
  if (chosen !== undefined) return chosen;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices.length) return (chosen = {}); // el motor no da la lista: usar su voz por defecto
    const es = voices.filter((v) => v.language.toLowerCase().replace('_', '-').startsWith('es'));
    if (!es.length) return (chosen = null);
    const rank = (v: Speech.Voice) => {
      const lang = v.language.toLowerCase().replace('_', '-');
      const i = ORDER.indexOf(lang);
      const country = i === -1 ? ORDER.length - 1 : i; // otros países, justo antes de España
      const id = v.identifier.toLowerCase();
      const net = id.includes('network') ? 1 : 0; // las voces "network" necesitan internet
      return net * 100 + country * 2 + (v.quality === Speech.VoiceQuality.Enhanced ? 0 : 1);
    };
    es.sort((a, b) => rank(a) - rank(b));
    return (chosen = { voice: es[0].identifier });
  } catch {
    return (chosen = {});
  }
}

let warned = false;

/** Lee un texto en voz alta en español. Si el teléfono no tiene voz en español, lo avisa una vez. */
export async function speak(text: string) {
  const v = await pick();
  if (v === null) {
    if (!warned) {
      warned = true;
      Alert.alert('No hay voz en español', 'Para que SaludAsist pueda hablar, instala la voz en español en los ajustes del teléfono («Salida de texto a voz»).', [
        { text: 'Cerrar', style: 'cancel' },
        ...(Platform.OS === 'android' ? [{ text: 'Abrir ajustes', onPress: () => Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings()) }] : []),
      ]);
    }
    return;
  }
  Speech.stop();
  Speech.speak(text, { language: 'es', ...v });
}
