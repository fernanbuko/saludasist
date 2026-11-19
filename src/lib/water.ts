import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadDevice, type DeviceState } from './storage';

/**
 * Recordatorio de agua: opcional (apagado por defecto) y suave. Es una notificación normal,
 * nunca una alarma, para no cansar a la persona y que no ignore los avisos de los medicamentos.
 */
export interface WaterSettings {
  on: boolean;
  every: number; // horas entre avisos
  from: number; // hora del primer aviso (0-23)
  to: number; // hora límite del último aviso
  goal: number; // vasos al día
}

export const WATER_DEFAULT: WaterSettings = { on: false, every: 2, from: 9, to: 20, goal: 8 };
export const WATER_CHANNEL = 'agua';
export const WATER_CATEGORY = 'agua';
export const ACTION_WATER = 'AGUA_VASO';

export const waterOf = (w?: Partial<WaterSettings>): WaterSettings => ({ ...WATER_DEFAULT, ...(w ?? {}) });

/** Horas de los avisos: p. ej. cada 2 h de 9 a 20 → 9, 11, 13, 15, 17, 19. */
export function waterHours(w: WaterSettings): number[] {
  const out: number[] = [];
  for (let h = w.from; h <= w.to && out.length < 24; h += Math.max(1, w.every)) out.push(h);
  return out;
}

export async function setupWaterChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(WATER_CHANNEL, {
      name: 'Recordatorio de agua',
      description: 'Avisos suaves para tomar agua durante el día',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
    { identifier: ACTION_WATER, buttonTitle: 'Ya tomé un vaso', options: { opensAppToForeground: true } },
  ]);
}

const DAYS_AHEAD = 3; // hoy y los dos días siguientes; se renuevan al abrir la app y en la revisión en segundo plano

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Programa los avisos de agua de los próximos días, uno por hora (si están activados).
 * Si hoy ya se llegó a la meta, no se avisa más hoy; mañana empieza de nuevo.
 */
export async function scheduleWater(dev?: DeviceState) {
  const d = dev ?? (await loadDevice());
  const w = waterOf(d.water);
  if (!w.on) return;
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const k = dayKey(day);
    if ((d.waterLog?.[k] ?? 0) >= w.goal) continue;
    for (const h of waterHours(w)) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0);
      if (at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `agua|${k}|${h}`,
        content: {
          title: '💧 Hora de tomar agua',
          body: 'Un vaso de agua te ayuda a sentirte bien. Pulsa «Ya tomé un vaso» para apuntarlo.',
          data: { type: 'agua' },
          categoryIdentifier: WATER_CATEGORY,
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: WATER_CHANNEL },
      });
    }
  }
}

/** Quita los avisos de agua que quedan hoy (al llegar a la meta). */
export async function cancelWaterToday() {
  const prefix = `agua|${dayKey(new Date())}|`;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Tras sumar o quitar un vaso: si se llegó a la meta, sin más avisos hoy; si no, se vuelven a programar. */
export async function refreshWater(dev: DeviceState) {
  const w = waterOf(dev.water);
  if (!w.on) return;
  if ((dev.waterLog?.[dayKey(new Date())] ?? 0) >= w.goal) await cancelWaterToday();
  else await scheduleWater(dev);
}
