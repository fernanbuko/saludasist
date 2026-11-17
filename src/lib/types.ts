export type MedType = 'pill' | 'liquid';

export type ScheduleMode = 'interval' | 'fixed';

export interface Med {
  id: string;
  name: string;
  dose: string; // "500 mg"
  qty: number; // cantidad por toma
  qtyUnit?: string; // líquidos: 'ml', 'gotas' o 'cucharadas' (las pastillas se cuentan en pastillas)
  /** 'interval': cada `everyHours` horas desde `startTime`; 'fixed': horas concretas elegidas a mano. */
  schedule: ScheduleMode;
  everyHours: number;
  startDate: string; // YYYY-MM-DD, primer día del tratamiento
  startTime: string; // HH:MM, primera toma (modo 'interval')
  durationDays: number | null; // null = de por vida
  times: string[]; // "HH:MM" de cada toma diaria (calculadas en modo 'interval')
  days: number[]; // 0=domingo … 6=sábado (solo modo 'fixed'; en 'interval' son todos)
  note: string;
  type: MedType;
  color: string;
}

export type LogStatus = 'taken' | 'proof' | 'skipped';

export interface LogEntry {
  status: LogStatus;
  at: number;
  verified?: boolean;
  aiNote?: string;
}

export interface Settings {
  patientName: string; // nombre de la persona que toma la medicación
  voice: boolean; // leer los recordatorios en voz alta (ajuste de este teléfono)
}

/** Datos de la medicación tal como los usan las pantallas. */
export interface AppState {
  v: 1;
  welcomed: boolean;
  createdAt: string; // fecha (YYYY-MM-DD) en que se empezó a usar la app
  meds: Med[];
  log: Record<string, LogEntry>; // clave: "YYYY-MM-DD|medId|HH:MM"
  alerted: Record<string, number>; // dosis olvidadas ya avisadas en este teléfono (modo familiar)
  snooze: Record<string, number>;
  settings: Settings;
}

export type MemberRole = 'owner' | 'caregiver';

export interface Member {
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: number;
}

/** Documento patients/{patientId} en Firestore: la medicación compartida de una persona. */
export interface PatientDoc {
  ownerUid: string; // la persona que toma la medicación
  patientName: string;
  createdAt: string;
  memberUids: string[];
  members: Record<string, Member>;
  meds: Med[];
  log: Record<string, LogEntry>;
  joinCode?: string;
}

export type EventType = 'taken' | 'proof' | 'skipped' | 'rejected';

/** Documento patients/{patientId}/events/{id}: avisos para la familia. */
export interface DoseEvent {
  type: EventType;
  key: string;
  medName: string;
  time: string;
  text: string;
  at: number;
  by: string; // uid de quien lo registró
}

export type DoseStatus = 'due' | 'upcoming' | 'taken' | 'proof' | 'missed' | 'skipped';

export interface DoseInstance {
  key: string;
  date: string;
  time: string;
  med: Med;
}
