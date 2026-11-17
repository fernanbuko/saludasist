import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { loadDevice } from './storage';
import Alarm from '../../modules/saludasist-alarm';
import { dividesDay, doseTxt, dkey, doseDate, instancesFor, isFinished, medInstances, parseKey, tmin, treatmentWindow, unitTxt } from './dose';
import type { AppState, Med } from './types';

export const CHANNEL = 'dosis';
export const CATEGORY = 'dosis';
export const ACTION_TAKEN = 'TOMADA';
export const ACTION_SNOOZE = 'POSPONER';
const FOLLOW_UP_MIN = 30;

export function configureHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      // Con la app abierta, además de mostrar el aviso, se lee en voz alta si está activado.
      try {
        const dev = await loadDevice();
        const { title, body } = n.request.content;
        if (dev.voice && title) Speech.speak(`${title}. ${body ?? ''}`, { language: 'es-ES' });
      } catch {}
      return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      };
    },
  });
}

export const FAMILY_CHANNEL = 'familia';

export async function setupChannelsAndActions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(FAMILY_CHANNEL, {
      name: 'Avisos de la familia',
      description: 'Tomas confirmadas, dosis olvidadas y fotos no verificadas de tu familiar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Recordatorios de medicamentos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      bypassDnd: true,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: 'Ya la tomé', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Posponer 10 min', options: { opensAppToForeground: true } },
  ]);
}

export async function requestPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

const followUpId = (key: string) => `follow|${key}`;

/** Días por delante que se programan como avisos sueltos en tratamientos con fin. */
const ROLLING_DAYS = 7;
/** Android admite unas 500 alarmas por app; dejamos margen para seguimientos y "posponer". */
const MAX_ALARMS = 400;

const doseContent = (m: Med, data: Record<string, string>): Notifications.NotificationContentInput => ({
  title: `Hora de tu medicamento: ${m.name}`,
  body: `${doseTxt(m)} · ${m.qty} ${unitTxt(m)}${m.note ? ` · ${m.note}` : ''}`,
  data,
  categoryIdentifier: CATEGORY,
  sound: 'default',
  priority: Notifications.AndroidNotificationPriority.MAX,
});

/**
 * Reprograma todos los avisos:
 *  - tratamientos de por vida ya empezados: un aviso repetitivo (diario o semanal) por hora, como alarma exacta;
 *  - tratamientos con fin, o que empiezan hoy o más tarde: avisos sueltos para cada toma de los próximos 7 días,
 *    así no suena nada fuera del tratamiento. Se renuevan al abrir la app y en la revisión en segundo plano;
 *  - un segundo aviso "¿Ya la tomaste?" 30 min después para las dosis de las próximas 24 h sin registrar.
 */
/** Días por delante que se programan como alarmas a pantalla completa (se renuevan al abrir la app y en segundo plano). */
const ALARM_DAYS = 4;
const MAX_FULLSCREEN_ALARMS = 150;

/** ¿Este teléfono usa la alarma a pantalla completa? (activada por defecto). */
export async function alarmModeOn() {
  if (!Alarm || Platform.OS !== 'android') return false;
  return (await loadDevice()).alarmMode !== false;
}

/** Texto bajo el nombre en la alarma: "500 mg · 1 pastilla · Con comida". */
const alarmDetail = (m: Med) => [doseTxt(m), `${m.qty} ${unitTxt(m)}`, m.note].filter(Boolean).join(' · ');

/** Programa las alarmas a pantalla completa de los próximos días. */
async function scheduleFullScreenAlarms(s: AppState) {
  if (!Alarm) return;
  Alarm.cancelAll();
  const voice = (await loadDevice()).voice;
  const now = new Date();
  const d = parseKey(dkey(now));
  let budget = MAX_FULLSCREEN_ALARMS;
  for (let i = 0; i < ALARM_DAYS && budget > 0; i++) {
    const k = dkey(d);
    for (const m of s.meds) {
      if (isFinished(m)) continue;
      for (const inst of medInstances(m, k)) {
        const at = doseDate(k, inst.time);
        if (at <= now || s.log[inst.key] || budget <= 0) continue;
        budget--;
        Alarm.schedule(inst.key, at.getTime(), m.name, alarmDetail(m), inst.time, voice);
      }
    }
    d.setDate(d.getDate() + 1);
  }
  try {
    Alarm.logSummary();
  } catch {}
}

export async function rescheduleAll(s: AppState) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (await alarmModeOn()) {
    await scheduleFullScreenAlarms(s);
    await scheduleFollowUps(s);
    return;
  }
  Alarm?.cancelAll();
  const now = new Date();
  const todayStart = parseKey(dkey(now));
  let budget = MAX_ALARMS;
  for (const m of s.meds) {
    if (isFinished(m)) continue;
    const w = treatmentWindow(m);
    // Avisos sueltos si el tratamiento tiene fin, aún no ha empezado o el intervalo no cae cada día a la misma hora.
    if (w.to != null || w.from >= todayStart || (m.schedule === 'interval' && !dividesDay(m.everyHours))) {
      const d = new Date(todayStart);
      for (let i = 0; i < ROLLING_DAYS && budget > 0; i++) {
        const k = dkey(d);
        for (const inst of medInstances(m, k)) {
          const at = doseDate(k, inst.time);
          if (at <= now || budget <= 0) continue;
          budget--;
          await Notifications.scheduleNotificationAsync({
            content: doseContent(m, { key: inst.key }),
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL, delivery: 'alarmClock' },
          });
        }
        d.setDate(d.getDate() + 1);
      }
      continue;
    }
    for (const t of m.times) {
      const [hour, minute] = t.split(':').map(Number);
      const content = doseContent(m, { medId: m.id, time: t });
      if (m.schedule === 'interval' || m.days.length === 7) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL, delivery: 'alarmClock' },
        });
      } else {
        for (const d of m.days) {
          await Notifications.scheduleNotificationAsync({
            content,
            // expo-notifications numera los días de 1 (domingo) a 7 (sábado)
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL, delivery: 'alarmClock' },
          });
        }
      }
    }
  }
  await scheduleFollowUps(s);
}

async function scheduleFollowUps(s: AppState) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  for (const k of [dkey(now), dkey(tomorrow)]) {
    for (const i of instancesFor(s, k)) {
      if (s.log[i.key]) continue;
      const [y, mo, d] = k.split('-').map(Number);
      const at = new Date(y, mo - 1, d, 0, tmin(i.time) + FOLLOW_UP_MIN);
      if (at <= now || at.getTime() - now.getTime() > 26 * 3600e3) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: followUpId(i.key),
        content: {
          title: `¿Ya tomaste ${i.med.name}?`,
          body: 'Todavía no está registrada. Confírmala con una foto del blíster.',
          data: { key: i.key },
          categoryIdentifier: CATEGORY,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  }
}

export async function cancelFollowUp(key: string) {
  // Al registrar la toma, también se quita su alarma si aún no había sonado.
  try {
    Alarm?.cancel(key);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(followUpId(key));
  } catch {}
}

export async function snoozeNotification(key: string, medName: string, minutes = 10, med?: Med) {
  if (await alarmModeOn()) {
    const time = key.split('|')[2] ?? '';
    Alarm!.schedule(key, Date.now() + minutes * 60_000, medName, med ? alarmDetail(med) : '', time, (await loadDevice()).voice);
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Recordatorio: ${medName}`,
      body: 'Pospusiste esta dosis. ¿Ya la tomaste?',
      data: { key },
      categoryIdentifier: CATEGORY,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL },
  });
}

/** Convierte los datos de una notificación en la clave de la dosis. */
export function keyFromNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.key === 'string') return data.key;
  if (typeof data.medId === 'string' && typeof data.time === 'string') {
    const now = new Date();
    const d = new Date(now);
    // Si la notificación se abre pasada la medianoche, la dosis es la del día anterior.
    if (tmin(data.time) > now.getHours() * 60 + now.getMinutes() + 5) d.setDate(d.getDate() - 1);
    return `${dkey(d)}|${data.medId}|${data.time}`;
  }
  return null;
}

/** Muestra ya una notificación en este teléfono (avisos para el familiar que cuida). */
export async function notifyFamily(title: string, body: string, data: Record<string, string> = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default', priority: Notifications.AndroidNotificationPriority.HIGH },
      trigger: Platform.OS === 'android' ? { channelId: FAMILY_CHANNEL } : null,
    });
  } catch {}
}

/** En el teléfono del familiar no deben sonar los recordatorios de toma: son para quien toma la medicación. */
export async function cancelDoseReminders() {
  try {
    Alarm?.cancelAll();
  } catch {}
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
