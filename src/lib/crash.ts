import { File, Paths } from 'expo-file-system';

/**
 * Diagnóstico de cierres inesperados.
 * - Errores nativos o de JavaScript que cierran la app: el plugin `plugins/withCrashLogger.js`
 *   los guarda en `last_crash.txt` y se muestran al volver a abrirla.
 * - Errores de JavaScript que no son fatales para Android: se capturan aquí y se muestran sin cerrar la app.
 */
const CRASH_FILE = 'last_crash.txt';

export function readLastCrash(): string | null {
  try {
    const f = new File(Paths.document, CRASH_FILE);
    if (!f.exists) return null;
    const text = f.textSync();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

export function clearLastCrash() {
  try {
    const f = new File(Paths.document, CRASH_FILE);
    if (f.exists) f.delete();
  } catch {}
}

type Listener = (msg: string) => void;
let listener: Listener | null = null;
let pending: string | null = null;

export function onJsError(l: Listener) {
  listener = l;
  if (pending) l(pending);
}

const g = globalThis as unknown as {
  ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
};

/** Sustituye el manejador global para mostrar el error en pantalla en lugar de cerrar la app. */
export function installJsErrorHandler() {
  const eu = g.ErrorUtils;
  if (!eu) return;
  eu.setGlobalHandler((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    const msg = `${err.name}: ${err.message}\n\n${err.stack ?? ''}`;
    try {
      new File(Paths.document, CRASH_FILE).write(msg);
    } catch {}
    pending = msg;
    listener?.(msg);
  });
}
