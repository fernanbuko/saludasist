import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, useColorScheme } from 'react-native';
import { applyTheme } from '../theme';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { signOutAll } from './authGoogle';
import {
  addEvent,
  createInvite as cloudCreateInvite,
  createPatient as cloudCreatePatient,
  joinWithCode as cloudJoin,
  leavePatient as cloudLeave,
  patientRef,
  removeMember as cloudRemoveMember,
  saveLogEntry,
  saveMeds,
  saveProfile as cloudSaveProfile,
  savePatientName,
  userRef,
  watchEvents,
  type Account,
} from './cloud';
import { dkey, findInstance, fmtStock, normalizeMed, stockInfo } from './dose';
import { waterOf, type WaterSettings } from './water';
import { eventText, notifyMissed, notifyNewEvents } from './family';
import { auth } from './firebase';
import { cancelDoseReminders, cancelFollowUp, notifyFamily, rescheduleAll } from './notifications';
import { clearLegacy, defaultDevice, loadCache, loadDevice, loadLegacy, saveCache, saveDevice, type DeviceState, type ThemeMode } from './storage';
import type { AppState, EventType, LogEntry, Med, Member, PatientDoc, PatientProfile } from './types';

/**
 * Estado de la cuenta:
 *  - loading: comprobando la sesión guardada;
 *  - signedOut: hay que iniciar sesión con Google;
 *  - needsProfile: la cuenta aún no está vinculada a ninguna medicación (crear la propia o unirse con un código);
 *  - ready: datos de la medicación disponibles.
 */
export type AccountStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';
/** patient: este teléfono es de quien toma la medicación (suenan los recordatorios). caregiver: familiar que acompaña. */
export type Role = 'patient' | 'caregiver';

interface Ctx {
  status: AccountStatus;
  account: Account | null;
  patientId: string | null;
  role: Role;
  members: Record<string, Member>;
  ownerUid: string | null;
  removed: boolean; // el dueño quitó a este familiar
  state: AppState;
  ready: boolean;
  /** Se incrementa cada 30 s para refrescar los estados que dependen de la hora. */
  tick: number;
  update: (fn: (s: AppState) => AppState) => void;
  saveMed: (m: Med) => void;
  deleteMed: (id: string) => void;
  markDose: (key: string, status: LogEntry['status'], extra?: Partial<LogEntry>) => void;
  reportRejected: (key: string, reason: string) => void;
  addStock: (medId: string, amount: number) => void;
  setPatientName: (name: string) => void;
  setVoice: (v: boolean) => void;
  profile: PatientProfile | null;
  saveProfile: (p: PatientProfile) => Promise<void>;
  alarmMode: boolean;
  setAlarmMode: (v: boolean) => void;
  themeMode: ThemeMode;
  /** La app se ve en modo oscuro (por el teléfono o porque se eligió en Ajustes). */
  dark: boolean;
  setThemeMode: (m: ThemeMode) => void;
  water: WaterSettings;
  setWater: (w: WaterSettings) => void;
  waterToday: number;
  addWater: (delta: number) => void;
  createPatient: (name: string) => Promise<void>;
  joinWithCode: (code: string) => Promise<void>;
  createInvite: () => Promise<string>;
  removeMember: (uid: string) => Promise<void>;
  leave: () => Promise<void>;
  signOut: () => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

const EMPTY: PatientDoc = { ownerUid: '', patientName: '', createdAt: dkey(new Date()), memberUids: [], members: {}, meds: [], log: {} };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [removed, setRemoved] = useState(false);
  const [device, setDevice] = useState<DeviceState>(defaultDevice);
  const [tick, setTick] = useState(0);
  const devRef = useRef(device);
  devRef.current = device;

  const commitDevice = useCallback((d: DeviceState) => {
    devRef.current = d;
    setDevice(d);
    saveDevice(d);
  }, []);

  // Sesión de Google/Firebase y ajustes de este teléfono.
  useEffect(() => {
    loadDevice().then((d) => {
      devRef.current = d;
      setDevice(d);
    });
    return onAuthStateChanged(auth, (u) => {
      setAccount(u ? { uid: u.uid, name: u.displayName || u.email || 'Sin nombre', email: u.email ?? '' } : null);
      setAuthReady(true);
      if (!u) {
        setPatientId(null);
        setPatient(null);
        setProfileLoaded(false);
      }
    });
  }, []);

  // A qué medicación está vinculada la cuenta (users/{uid}).
  useEffect(() => {
    if (!account) return;
    setProfileLoaded(false);
    let cancelled = false;
    // Sin conexión, se usa la última copia guardada mientras llega la respuesta.
    loadCache().then((c) => {
      if (!cancelled && c && c.uid === account.uid) {
        setPatientId((p) => p ?? c.patientId);
        setPatient((p) => p ?? c.patient);
        setProfileLoaded(true);
      }
    });
    const unsub = onSnapshot(
      userRef(account.uid),
      (snap) => {
        const pid = (snap.data()?.patientId as string | null | undefined) ?? null;
        setPatientId(pid);
        if (!pid) setPatient(null);
        setProfileLoaded(true);
      },
      () => setProfileLoaded(true),
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [account]);

  // La medicación compartida (patients/{patientId}), en tiempo real.
  useEffect(() => {
    if (!account || !patientId) return;
    setRemoved(false);
    return onSnapshot(
      patientRef(patientId),
      (snap) => {
        if (!snap.exists()) {
          setPatient(null);
          return;
        }
        const data = snap.data() as PatientDoc;
        const p: PatientDoc = { ...EMPTY, ...data, meds: (data.meds ?? []).map((m) => normalizeMed(m, data.createdAt)) };
        setPatient(p);
        saveCache({ uid: account.uid, patientId, patient: p });
      },
      (err) => {
        // Sin permiso: el dueño quitó a este familiar de la medicación.
        if ((err as { code?: string }).code === 'permission-denied') {
          setRemoved(true);
          setPatient(null);
          saveCache(null);
        }
      },
    );
  }, [account, patientId]);

  const status: AccountStatus = !authReady
    ? 'loading'
    : !account
      ? 'signedOut'
      : !profileLoaded
        ? 'loading'
        : !patientId || removed
          ? 'needsProfile'
          : patient
            ? 'ready'
            : 'loading';

  const role: Role = patient && account && patient.ownerUid !== account.uid ? 'caregiver' : 'patient';

  const state: AppState = useMemo(() => {
    const p = patient ?? EMPTY;
    return {
      v: 1,
      welcomed: true,
      createdAt: p.createdAt,
      meds: p.meds,
      log: p.log ?? {},
      alerted: device.alerted,
      snooze: device.snooze,
      settings: { patientName: p.patientName, voice: device.voice },
    };
  }, [patient, device]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Recordatorios: solo en el teléfono de quien toma la medicación.
  const resched = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'ready') return;
    if (resched.current) clearTimeout(resched.current);
    resched.current = setTimeout(() => {
      if (role === 'patient') rescheduleAll(stateRef.current).catch(() => {});
      else cancelDoseReminders();
    }, 800);
  }, [status, role, patient?.meds, patient?.log]);

  // Avisos para el familiar: eventos nuevos en tiempo real.
  const who = patient?.patientName || 'Tu familiar';
  useEffect(() => {
    if (status !== 'ready' || role !== 'caregiver' || !patientId || !account) return;
    return watchEvents(patientId, async (events) => {
      const next = await notifyNewEvents(events, devRef.current, account.uid, who);
      if (next !== devRef.current) commitDevice(next);
    });
  }, [status, role, patientId, account, who, commitDevice]);

  // Refresco periódico y avisos de dosis olvidadas (familiar).
  useEffect(() => {
    if (status !== 'ready') return;
    const run = async () => {
      setTick((t) => t + 1);
      if (role === 'caregiver') {
        const next = await notifyMissed(stateRef.current, devRef.current, who);
        if (next !== devRef.current) commitDevice(next);
      }
    };
    run();
    const id = setInterval(run, 30_000);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') {
        run();
        if (role === 'patient') rescheduleAll(stateRef.current).catch(() => {});
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [status, role, who, commitDevice]);

  const update = useCallback(
    (fn: (s: AppState) => AppState) => {
      const next = fn(stateRef.current);
      commitDevice({ ...devRef.current, snooze: next.snooze, voice: next.settings.voice });
    },
    [commitDevice],
  );

  const pidRef = useRef(patientId);
  pidRef.current = patientId;
  const patientRefState = useRef(patient);
  patientRefState.current = patient;

  const saveMed = useCallback((m: Med) => {
    const pid = pidRef.current;
    const p = patientRefState.current;
    if (!pid || !p) return;
    const exists = p.meds.some((x) => x.id === m.id);
    const meds = exists ? p.meds.map((x) => (x.id === m.id ? m : x)) : [...p.meds, m];
    setPatient({ ...p, meds });
    saveMeds(pid, meds).catch(() => {});
  }, []);

  const deleteMed = useCallback((id: string) => {
    const pid = pidRef.current;
    const p = patientRefState.current;
    if (!pid || !p) return;
    const meds = p.meds.filter((m) => m.id !== id);
    setPatient({ ...p, meds });
    saveMeds(pid, meds).catch(() => {});
  }, []);

  const logEvent = useCallback(
    (type: EventType, key: string, extra = '') => {
      const pid = pidRef.current;
      const inst = findInstance(stateRef.current, key);
      if (!pid || !inst || !account) return;
      addEvent(pid, { type, key, medName: inst.med.name, time: inst.time, text: eventText(type, inst, extra), at: Date.now(), by: account.uid }).catch(() => {});
    },
    [account],
  );

  const markDose = useCallback(
    (key: string, status: LogEntry['status'], extra: Partial<LogEntry> = {}) => {
      const pid = pidRef.current;
      const p = patientRefState.current;
      if (!pid || !p) return;
      const entry: LogEntry = { status, at: Date.now(), ...extra };
      // Descontar de las existencias la primera vez que esta toma cuenta como tomada.
      const prev = p.log[key]?.status;
      const counts = (st?: string) => st === 'taken' || st === 'proof';
      let meds = p.meds;
      let lowMsg = '';
      const med = p.meds.find((m) => m.id === key.split('|')[1]);
      if (med && med.stock != null && counts(status) && !counts(prev)) {
        const today = dkey(new Date());
        let updated: Med = { ...med, stock: Math.max(0, Math.round((med.stock - (med.qty || 1)) * 100) / 100) };
        const info = stockInfo(updated);
        if (info?.low && updated.stockAlertedOn !== today) {
          lowMsg = info.out
            ? `Se acabó ${med.name}. Hay que comprar más.`
            : `Quedan ${fmtStock(info.stock)} ${info.unit} de ${med.name} (unos ${Math.max(1, Math.floor(info.daysLeft))} días). Hay que comprar más.`;
          updated = { ...updated, stockAlertedOn: today };
        }
        meds = p.meds.map((m) => (m.id === med.id ? updated : m));
        saveMeds(pid, meds).catch(() => {});
      }
      setPatient({ ...p, log: { ...p.log, [key]: entry }, meds });
      saveLogEntry(pid, key, entry).catch(() => {});
      const snooze = { ...devRef.current.snooze };
      delete snooze[key];
      commitDevice({ ...devRef.current, snooze });
      cancelFollowUp(key);
      logEvent(status, key, status === 'taken' ? (extra.verified ? `Verificada con foto por la IA. ${extra.aiNote ?? ''}`.trim() : 'Registrada sin foto.') : '');
      if (lowMsg) {
        notifyFamily('Hay que comprar más', lowMsg);
        logEvent('lowstock', key, lowMsg);
      }
    },
    [commitDevice, logEvent],
  );

  /** Suma unidades a las existencias (p. ej. al comprar una caja nueva). */
  const addStock = useCallback((medId: string, amount: number) => {
    const pid = pidRef.current;
    const p = patientRefState.current;
    if (!pid || !p || !(amount > 0)) return;
    const meds = p.meds.map((m) => (m.id === medId ? { ...m, stock: Math.round(((m.stock ?? 0) + amount) * 100) / 100, stockAlertedOn: undefined } : m));
    setPatient({ ...p, meds });
    saveMeds(pid, meds).catch(() => {});
  }, []);

  const reportRejected = useCallback((key: string, reason: string) => logEvent('rejected', key, reason), [logEvent]);

  const setPatientName = useCallback((name: string) => {
    const pid = pidRef.current;
    if (pid && name.trim()) savePatientName(pid, name.trim()).catch(() => {});
  }, []);

  const saveProfile = useCallback(async (prof: PatientProfile) => {
    const pid = pidRef.current;
    const p = patientRefState.current;
    if (!pid || !p) return;
    setPatient({ ...p, profile: prof });
    await cloudSaveProfile(pid, prof);
  }, []);

  const setWater = useCallback(
    (w: WaterSettings) => {
      commitDevice({ ...devRef.current, water: w });
      // Volver a programar los avisos (incluye los de agua) con el nuevo horario.
      setTimeout(() => {
        if (patientRefState.current && account && patientRefState.current.ownerUid === account.uid) rescheduleAll(stateRef.current).catch(() => {});
      }, 300);
    },
    [commitDevice, account],
  );

  const setThemeMode = useCallback((m: ThemeMode) => commitDevice({ ...devRef.current, theme: m }), [commitDevice]);

  const addWater = useCallback(
    (delta: number) => {
      const d = devRef.current;
      const today = dkey(new Date());
      const n = Math.max(0, (d.waterLog?.[today] ?? 0) + delta);
      // Solo se guardan los últimos 14 días.
      const keep = Object.fromEntries(Object.entries(d.waterLog ?? {}).filter(([k]) => k >= dkey(new Date(Date.now() - 14 * 86400e3))));
      commitDevice({ ...d, waterLog: { ...keep, [today]: n } });
    },
    [commitDevice],
  );

  const setVoice = useCallback((v: boolean) => commitDevice({ ...devRef.current, voice: v }), [commitDevice]);

  const setAlarmMode = useCallback(
    (v: boolean) => {
      commitDevice({ ...devRef.current, alarmMode: v });
      // Volver a programar los recordatorios con el nuevo tipo de aviso.
      setTimeout(() => {
        if (patientRefState.current && account && patientRefState.current.ownerUid === account.uid) rescheduleAll(stateRef.current).catch(() => {});
      }, 300);
    },
    [commitDevice, account],
  );

  const createPatient = useCallback(
    async (name: string) => {
      if (!account) return;
      const legacy = await loadLegacy();
      await cloudCreatePatient(account, name || legacy?.patientName || account.name, legacy ?? undefined);
      if (legacy) clearLegacy();
    },
    [account],
  );

  const joinWithCode = useCallback(
    async (code: string) => {
      if (!account) return;
      await cloudJoin(account, code);
      // Los avisos de dosis olvidadas empiezan a contar desde ahora, no desde el historial antiguo.
      commitDevice({ ...devRef.current, alerted: {}, lastEventAt: Date.now(), familyChecksFrom: Date.now() });
    },
    [account, commitDevice],
  );

  const createInvite = useCallback(async () => {
    if (!account || !pidRef.current) throw new Error('Sin cuenta');
    return cloudCreateInvite(pidRef.current, account.uid);
  }, [account]);

  const removeMember = useCallback(async (uid: string) => {
    if (pidRef.current) await cloudRemoveMember(pidRef.current, uid);
  }, []);

  const leave = useCallback(async () => {
    if (!account || !pidRef.current) return;
    await cloudLeave(pidRef.current, account.uid);
    saveCache(null);
    cancelDoseReminders();
  }, [account]);

  const signOut = useCallback(async () => {
    await cancelDoseReminders();
    saveCache(null);
    await signOutAll();
  }, []);

  // Modo claro/oscuro: al cambiar, todas las pantallas (que usan este contexto) se vuelven a dibujar con la nueva paleta.
  const scheme = useColorScheme();
  const themeMode = device.theme ?? 'auto';
  const dark = themeMode === 'dark' || (themeMode === 'auto' && scheme === 'dark');
  applyTheme(dark);

  const value: Ctx = {
    status,
    account,
    patientId,
    role,
    members: patient?.members ?? {},
    ownerUid: patient?.ownerUid ?? null,
    removed,
    state,
    ready: status === 'ready',
    tick,
    update,
    saveMed,
    deleteMed,
    markDose,
    reportRejected,
    addStock,
    setPatientName,
    setVoice,
    profile: patient?.profile ?? null,
    saveProfile,
    alarmMode: device.alarmMode !== false,
    setAlarmMode,
    themeMode,
    dark,
    setThemeMode,
    water: waterOf(device.water),
    setWater,
    waterToday: device.waterLog?.[dkey(new Date())] ?? 0,
    addWater,
    createPatient,
    joinWithCode,
    createInvite,
    removeMember,
    leave,
    signOut,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp() {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useApp fuera de StoreProvider');
  return c;
}
