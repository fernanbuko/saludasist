import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatientDoc } from './types';

/**
 * Datos guardados solo en este teléfono:
 *  - la última copia de la medicación (para abrir la app sin conexión y para la revisión en segundo plano);
 *  - ajustes y avisos propios del dispositivo (voz, dosis pospuestas, avisos ya mostrados al familiar).
 */
const CACHE = 'saludasist.cache.v2';
const DEVICE = 'saludasist.device.v2';
const LEGACY = 'saludasist.state.v1';

export interface Cache {
  uid: string;
  patientId: string;
  patient: PatientDoc;
}

export interface DeviceState {
  voice: boolean;
  alarmMode: boolean; // recordatorios como alarma a pantalla completa (por defecto, sí)
  snooze: Record<string, number>;
  alerted: Record<string, number>; // dosis olvidadas ya avisadas en este teléfono
  lastEventAt: number; // último aviso de la familia ya mostrado
  familyChecksFrom: number; // los avisos de dosis olvidadas empiezan a contar desde aquí
}

export const defaultDevice = (): DeviceState => ({ voice: true, alarmMode: true, snooze: {}, alerted: {}, lastEventAt: Date.now(), familyChecksFrom: Date.now() });

export async function loadCache(): Promise<Cache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}
export const saveCache = (c: Cache | null) => (c ? AsyncStorage.setItem(CACHE, JSON.stringify(c)) : AsyncStorage.removeItem(CACHE)).catch(() => {});

export async function loadDevice(): Promise<DeviceState> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE);
    if (raw) return { ...defaultDevice(), ...(JSON.parse(raw) as Partial<DeviceState>) };
  } catch {}
  return defaultDevice();
}
export const saveDevice = (d: DeviceState) => AsyncStorage.setItem(DEVICE, JSON.stringify(d)).catch(() => {});

/** Medicamentos guardados por versiones anteriores (sin cuenta), para subirlos a la nube la primera vez. */
export async function loadLegacy(): Promise<{ meds: PatientDoc['meds']; log: PatientDoc['log']; patientName: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.meds?.length) return null;
    return { meds: s.meds, log: s.log ?? {}, patientName: s.settings?.patientName ?? '' };
  } catch {
    return null;
  }
}
export const clearLegacy = () => AsyncStorage.removeItem(LEGACY).catch(() => {});
