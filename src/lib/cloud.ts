import {
  FieldPath,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { dkey } from './dose';
import type { DoseEvent, LogEntry, Med, PatientDoc, PatientProfile } from './types';

/**
 * Estructura en Firestore:
 *   users/{uid}                    → { name, email, patientId }   (a qué medicación está vinculada la cuenta)
 *   patients/{patientId}           → PatientDoc                   (medicamentos, tomas y miembros)
 *   patients/{patientId}/events/*  → DoseEvent                    (avisos para la familia)
 *   invites/{codigo}               → { patientId, createdBy, expiresAt }
 *   config/app                     → { versionCode, versionName, apkUrl, notes } (aviso de actualización)
 */

export interface Account {
  uid: string;
  name: string;
  email: string;
}

export const userRef = (uid: string) => doc(db, 'users', uid);
export const patientRef = (pid: string) => doc(db, 'patients', pid);
const eventsCol = (pid: string) => collection(db, 'patients', pid, 'events');

/** Crea la medicación de la persona que inicia sesión (ella misma toma los medicamentos). */
export async function createPatient(acc: Account, patientName: string, initial?: { meds: Med[]; log: Record<string, LogEntry> }) {
  const ref = doc(collection(db, 'patients'));
  const data: PatientDoc = {
    ownerUid: acc.uid,
    patientName: patientName.trim() || acc.name,
    createdAt: dkey(new Date()),
    memberUids: [acc.uid],
    members: { [acc.uid]: { name: acc.name, email: acc.email, role: 'owner', joinedAt: Date.now() } },
    meds: initial?.meds ?? [],
    log: initial?.log ?? {},
  };
  await setDoc(ref, data);
  await setDoc(userRef(acc.uid), { name: acc.name, email: acc.email, patientId: ref.id, updatedAt: serverTimestamp() }, { merge: true });
  return ref.id;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para que no se confundan
export const INVITE_HOURS = 48;

/** Genera un código de invitación válido durante 48 h para que un familiar se una. */
export async function createInvite(pid: string, uid: string) {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  await setDoc(doc(db, 'invites', code), { patientId: pid, createdBy: uid, createdAt: Date.now(), expiresAt: Date.now() + INVITE_HOURS * 3600e3 });
  return code;
}

export class JoinError extends Error {}

/** Une la cuenta del familiar a la medicación indicada por el código. */
export async function joinWithCode(acc: Account, rawCode: string) {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw new JoinError('El código tiene 6 letras y números. Revísalo.');
  const inv = await getDoc(doc(db, 'invites', code));
  if (!inv.exists()) throw new JoinError('Ese código no existe. Pide uno nuevo a tu familiar.');
  const { patientId, expiresAt } = inv.data() as { patientId: string; expiresAt: number };
  if (expiresAt < Date.now()) throw new JoinError('El código ha caducado. Pide uno nuevo a tu familiar.');
  await updateDoc(
    patientRef(patientId),
    'memberUids',
    arrayUnion(acc.uid),
    new FieldPath('members', acc.uid),
    { name: acc.name, email: acc.email, role: 'caregiver', joinedAt: Date.now() },
    'joinCode',
    code,
  );
  await setDoc(userRef(acc.uid), { name: acc.name, email: acc.email, patientId, updatedAt: serverTimestamp() }, { merge: true });
  return patientId;
}

/** El dueño quita a un familiar. */
export const removeMember = (pid: string, uid: string) =>
  updateDoc(patientRef(pid), 'memberUids', arrayRemove(uid), new FieldPath('members', uid), deleteField());

/** Un familiar deja de seguir la medicación. */
export async function leavePatient(pid: string, uid: string) {
  await updateDoc(patientRef(pid), 'memberUids', arrayRemove(uid), new FieldPath('members', uid), deleteField());
  await setDoc(userRef(uid), { patientId: null, updatedAt: serverTimestamp() }, { merge: true });
}

export const saveMeds = (pid: string, meds: Med[]) => updateDoc(patientRef(pid), { meds: JSON.parse(JSON.stringify(meds)) });
export const saveProfile = (pid: string, profile: PatientProfile) => updateDoc(patientRef(pid), { profile: JSON.parse(JSON.stringify(profile)) });
export const savePatientName = (pid: string, name: string) => updateDoc(patientRef(pid), { patientName: name });
export const saveLogEntry = (pid: string, key: string, entry: LogEntry) =>
  updateDoc(patientRef(pid), new FieldPath('log', key), JSON.parse(JSON.stringify(entry)));

export const addEvent = (pid: string, ev: DoseEvent) => addDoc(eventsCol(pid), ev);

export const watchEvents = (pid: string, cb: (events: (DoseEvent & { id: string })[]) => void): Unsubscribe =>
  onSnapshot(
    query(eventsCol(pid), orderBy('at', 'desc'), limit(20)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DoseEvent) }))),
    () => {},
  );

export async function fetchEvents(pid: string): Promise<DoseEvent[]> {
  const snap = await getDocs(query(eventsCol(pid), orderBy('at', 'desc'), limit(20)));
  return snap.docs.map((d) => d.data() as DoseEvent);
}

export async function fetchPatient(pid: string): Promise<PatientDoc | null> {
  const snap = await getDoc(patientRef(pid));
  return snap.exists() ? (snap.data() as PatientDoc) : null;
}

export async function readAppConfig(): Promise<{ versionCode: number; versionName: string; apkUrl: string; notes?: string } | null> {
  try {
    const s = await getDoc(doc(db, 'config', 'app'));
    return s.exists() ? (s.data() as never) : null;
  } catch {
    return null;
  }
}
