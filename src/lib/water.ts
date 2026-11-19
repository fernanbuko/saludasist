import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadDevice } from './storage';

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

/** Programa los avisos diarios de agua (si están activados). Se llama al reprogramar todos los avisos. */
export async function scheduleWater() {
  const w = waterOf((await loadDevice()).water);
  if (!w.on) return;
  for (const h of waterHours(w)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `agua|${h}`,
      content: {
        title: '💧 Hora de tomar agua',
        body: 'Un vaso de agua te ayuda a sentirte bien. Pulsa «Ya tomé un vaso» para apuntarlo.',
        data: { type: 'agua' },
        categoryIdentifier: WATER_CATEGORY,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: 0, channelId: WATER_CHANNEL },
    });
  }
}
