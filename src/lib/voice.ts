import { Alert, Linking, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import Alarm from '../../modules/saludasist-alarm';

/**
 * Voz en español: se usa una voz instalada en el teléfono (primero Latinoamérica, luego España).
 * La elige Android directamente (la misma lógica que la alarma) y solo se guarda cuando se encontró una;
 * si el motor de voz aún no había arrancado, se vuelve a intentar la próxima vez.
 */
let chosen: string | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Nombre de la voz, '' si el teléfono no tiene voz en español, o undefined si no se pudo saber. */
async function pickVoice(): Promise<string | undefined> {
  if (chosen) return chosen;
  if (Alarm && Platform.OS === 'android') {
    try {
      const v = await Alarm.spanishVoice();
      if (v) chosen = v;
      return v;
    } catch {}
  }
  // Respaldo: la lista de voces de expo-speech (puede llegar vacía mientras el motor arranca).
  for (let i = 0; i < 6; i++) {
    try {
      const all = await Speech.getAvailableVoicesAsync();
      if (all.length) {
        const es = all.filter((v) => v.language.toLowerCase().startsWith('es') && !v.identifier.toLowerCase().includes('network'));
        // Latinoamérica primero; España al final.
        const rank = (x: Speech.Voice) => {
          const l = x.language.toLowerCase().replace('_', '-');
          return l === 'es-us' ? 0 : l === 'es-mx' ? 1 : l === 'es-es' ? 9 : 5;
        };
        es.sort((a, b) => rank(a) - rank(b));
        if (es[0]) chosen = es[0].identifier;
        return es[0]?.identifier ?? '';
      }
    } catch {}
    await sleep(300);
  }
  return undefined;
}

/** Quita los símbolos de formato (asteriscos, almohadillas, viñetas) para que no se lean ni confundan a la voz. */
function clean(text: string) {
  return text
    .replace(/[*_#`>~]+/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/💧/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Android lee como mucho unos 4000 caracteres de una vez: se parte en frases. */
function chunks(text: string, max = 1500): string[] {
  const out: string[] = [];
  let cur = '';
  for (const s of text.replace(/([.!?:;])\s+/g, '$1\u0001').split('\u0001')) {
    if ((cur + ' ' + s).length > max && cur) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > max ? c.match(new RegExp(`.{1,${max}}`, 'g')) ?? [] : [c]));
}

let warned = false;
const warn = (title: string, msg: string) => {
  if (warned) return;
  warned = true;
  Alert.alert(title, msg, [
    { text: 'Cerrar', style: 'cancel' },
    ...(Platform.OS === 'android' ? [{ text: 'Abrir ajustes de voz', onPress: () => Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings()) }] : []),
  ]);
};

/** Lee un texto en voz alta en español. Si no se puede, lo explica en vez de quedarse en silencio. */
export async function speak(text: string) {
  const voice = await pickVoice();
  if (voice === '') {
    warn('No hay voz en español', 'Para que SaludAsist pueda hablar, instala la voz en español en los ajustes del teléfono («Salida de texto a voz»).');
    return;
  }
  await Speech.stop().catch(() => {});
  const parts = chunks(clean(text));
  parts.forEach((p, i) =>
    Speech.speak(p, {
      language: 'es',
      ...(voice ? { voice } : {}),
      onError: i === 0 ? () => warn('No se pudo leer en voz alta', 'Revisa en los ajustes del teléfono («Salida de texto a voz») que esté instalada la voz en español.') : undefined,
    }),
  );
}
