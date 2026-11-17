import { doseDate, doseTxt, fmtTime, unalertedMissed } from './dose';
import { notifyFamily } from './notifications';
import type { DeviceState } from './storage';
import type { AppState, DoseEvent, DoseInstance, EventType } from './types';

/**
 * Avisos en el teléfono del familiar que cuida (sin servidores ni apps extra):
 *  - eventos que registra la persona al tomar, omitir o enviar una foto no verificada;
 *  - dosis que llevan más de 1 hora sin registrarse (se calculan en este teléfono).
 * Se revisan al momento con la app abierta y cada 15-30 min en segundo plano.
 */

const TITLES: Record<EventType, (who: string, med: string) => string> = {
  taken: (w, m) => `${w} tomó ${m}`,
  proof: (w, m) => `${w} marcó ${m} como tomada`,
  skipped: (w, m) => `${w} omitió ${m}`,
  rejected: (w, m) => `Foto no verificada: ${m} (${w})`,
};

export function eventText(type: EventType, inst: DoseInstance, extra = ''): string {
  const base = `${inst.med.name} ${doseTxt(inst.med)} de las ${fmtTime(inst.time)}.`;
  switch (type) {
    case 'taken':
      return `${base} ${extra || 'Registrada sin foto.'}`;
    case 'proof':
      return `${base} Falta subir la foto de comprobante.`;
    case 'skipped':
      return `${base} Se marcó como omitida.`;
    case 'rejected':
      return `${base} La IA no pudo confirmar la foto. ${extra}`;
  }
}

/** Muestra los avisos nuevos de la familia y devuelve el estado del dispositivo actualizado. */
export async function notifyNewEvents(events: DoseEvent[], dev: DeviceState, myUid: string, who: string): Promise<DeviceState> {
  const fresh = events.filter((e) => e.at > dev.lastEventAt && e.by !== myUid).sort((a, b) => a.at - b.at);
  for (const e of fresh) await notifyFamily(TITLES[e.type](who, e.medName), e.text, { key: e.key });
  const newest = Math.max(dev.lastEventAt, ...events.map((e) => e.at));
  return fresh.length || newest > dev.lastEventAt ? { ...dev, lastEventAt: newest } : dev;
}

/** Avisa de cada dosis olvidada una sola vez (solo las posteriores a vincular este teléfono). */
export async function notifyMissed(state: AppState, dev: DeviceState, who: string): Promise<DeviceState> {
  const missed = unalertedMissed({ ...state, alerted: dev.alerted }).filter((i) => doseDate(i.date, i.time).getTime() >= dev.familyChecksFrom);
  if (!missed.length) return dev;
  const alerted = { ...dev.alerted };
  for (const i of missed) {
    await notifyFamily(`${who} no ha confirmado ${i.med.name}`, `${i.med.name} ${doseTxt(i.med)} de las ${fmtTime(i.time)} sigue sin registrarse. Quizá quieras llamarle.`, { key: i.key });
    alerted[i.key] = Date.now();
  }
  return { ...dev, alerted };
}
