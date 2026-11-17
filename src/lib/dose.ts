import type { AppState, DoseInstance, DoseStatus, Med, MedType } from './types';

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const COLORS = ['#3A6EA5', '#D2453F', '#E39B2D', '#3E9B4F', '#8A5BB8', '#2D9C9C'];

/** Minutos tras la hora programada a partir de los cuales una dosis cuenta como olvidada. */
export const MISSED_AFTER_MIN = 60;

const pad = (n: number) => String(n).padStart(2, '0');
export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const tmin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
/** Hora en formato de 24 horas: "08:00", "16:30". */
export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};
export const ikey = (date: string, medId: string, time: string) => `${date}|${medId}|${time}`;
export const newId = () => Math.random().toString(36).slice(2, 10);

/** Unidades de la dosis que se pueden elegir. */
/** Unidades de la dosis según el tipo de medicamento. La primera es la que se pone por defecto. */
export const PILL_UNITS = ['mg', 'g', 'mcg', 'UI'];
export const LIQUID_UNITS = ['ml', 'gotas', 'cucharadas', 'mg/ml'];
export const DOSE_UNITS = [...PILL_UNITS, ...LIQUID_UNITS];
export const unitsFor = (type: MedType) => (type === 'liquid' ? LIQUID_UNITS : PILL_UNITS);
/** Cómo se mide lo que toma cada vez un líquido. */
export const LIQUID_QTY_UNITS = ['ml', 'gotas', 'cucharadas'];

/** Separa "500 mg" en número y unidad. Un número sin unidad (dato antiguo) toma la unidad por defecto del tipo: mg o ml. */
export function parseDose(dose: string, type: MedType = 'pill'): { amount: string; unit: string } {
  const def = unitsFor(type)[0];
  const m = /^\s*([\d.,]+)\s*(.*)$/.exec(dose ?? '');
  if (!m) return { amount: '', unit: def };
  const unit = m[2].trim();
  return { amount: m[1], unit: DOSE_UNITS.find((u) => u.toLowerCase() === unit.toLowerCase()) ?? (unit || def) };
}

/** Dosis para mostrar, siempre con unidad: "20 mg". */
export function doseTxt(m: Med): string {
  const p = parseDose(m.dose, m.type);
  return p.amount ? `${p.amount} ${p.unit}` : m.dose || '—';
}

/** Unidad de la cantidad por toma, en singular o plural: "1 pastilla", "5 ml", "2 cucharadas". */
export function unitTxt(m: Med) {
  const one = m.qty === 1;
  if (m.type !== 'liquid') return one ? 'pastilla' : 'pastillas';
  const u = m.qtyUnit ?? 'ml';
  if (u === 'gotas') return one ? 'gota' : 'gotas';
  if (u === 'cucharadas') return one ? 'cucharada' : 'cucharadas';
  return u;
}

/** Atajos de intervalo en el formulario; también se puede escribir cualquier número de horas. */
export const INTERVALS = [4, 6, 8, 12, 24];
export const MIN_INTERVAL_H = 1;
export const MAX_INTERVAL_H = 72;

const toHHMM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const hhmmOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** ¿El intervalo cabe un número exacto de veces en 24 h? Entonces las tomas caen a la misma hora cada día. */
export const dividesDay = (everyHours: number) => 24 % everyHours === 0;

/** Horas del día de un tratamiento "cada N horas" (solo si N divide 24). Ej.: 14:00 cada 8 h → 06:00, 14:00, 22:00. */
export function intervalTimes(start: string, everyHours: number): string[] {
  if (!dividesDay(everyHours)) return [start];
  const n = Math.max(1, Math.round(24 / everyHours));
  const out = Array.from({ length: n }, (_, k) => toHHMM(tmin(start) + k * everyHours * 60));
  return [...new Set(out)].sort((a, b) => tmin(a) - tmin(b));
}

/** Fecha y hora (local) de una toma. */
export const doseDate = (dateKey: string, time: string) => {
  const d = parseKey(dateKey);
  d.setMinutes(tmin(time));
  return d;
};

/**
 * Ventana del tratamiento: desde la primera toma hasta `durationDays` días después (exclusivo).
 * En modo "cada N horas" la ventana empieza a la hora de la primera toma, de modo que
 * "cada 8 h durante 7 días" da exactamente 21 tomas.
 */
export function treatmentWindow(m: Med): { from: Date; to: Date | null } {
  const from = doseDate(m.startDate, m.schedule === 'interval' ? m.startTime : '00:00');
  if (m.durationDays == null) return { from, to: null };
  const to = new Date(from);
  to.setDate(to.getDate() + m.durationDays);
  return { from, to };
}

export function inTreatment(m: Med, dateKey: string, time: string) {
  const at = doseDate(dateKey, time);
  const w = treatmentWindow(m);
  return at >= w.from && (w.to == null || at < w.to);
}

/** Toma número k (0, 1, 2…) de un tratamiento "cada N horas", contando desde la primera. */
const nthDose = (m: Med, k: number) => {
  const d = new Date(treatmentWindow(m).from);
  d.setMinutes(d.getMinutes() + Math.round(k * m.everyHours * 60));
  return d;
};

/** Número de tomas totales de un tratamiento con fin (null si es de por vida). */
export function totalDoses(m: Med): number | null {
  if (m.durationDays == null) return null;
  if (m.schedule === 'interval') return Math.ceil((m.durationDays * 24) / m.everyHours);
  let n = 0;
  const d = parseKey(m.startDate);
  for (let i = 0; i < m.durationDays; i++) {
    if (m.days.includes(d.getDay())) n += m.times.length;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** Fecha y hora de la última toma de un tratamiento con fin. */
export function lastDose(m: Med): Date | null {
  const w = treatmentWindow(m);
  if (!w.to) return null;
  if (m.schedule === 'interval') {
    const n = totalDoses(m) ?? 0;
    return n > 0 ? nthDose(m, n - 1) : null;
  }
  const d = new Date(w.to);
  for (let i = 0; i < 3; i++) {
    const k = dkey(d);
    const ins = medInstances(m, k).filter((x) => doseDate(k, x.time) < w.to!);
    if (ins.length) return doseDate(k, ins[ins.length - 1].time);
    d.setDate(d.getDate() - 1);
  }
  return null;
}

/** Día del tratamiento (1…N) de una toma, contado en bloques de 24 h desde la primera toma. */
export function treatmentDay(m: Med, dateKey: string, time: string): { day: number; of: number | null } | null {
  const w = treatmentWindow(m);
  const at = doseDate(dateKey, time);
  if (at < w.from || (w.to && at >= w.to)) return null;
  const day = Math.floor((at.getTime() - w.from.getTime()) / 86400e3) + 1;
  return { day, of: m.durationDays };
}

export const fmtDate = (d: Date) => d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export const everyTxt = (h: number) => (h === 24 ? 'Una vez al día' : h === 48 ? 'Cada 2 días' : `Cada ${h} h`);

export function freqTxt(m: Med) {
  const how =
    m.schedule === 'interval'
      ? everyTxt(m.everyHours)
      : `${m.times.length}× al día · ${
          m.days.length === 7
            ? 'diario'
            : m.days.length === 5 && !m.days.includes(0) && !m.days.includes(6)
              ? 'lun a vie'
              : DAY_ORDER.filter((x) => m.days.includes(x)).map((x) => DAYS[x]).join(' ')
        }`;
  return `${how} · ${durationTxt(m)}`;
}

/** Horas de las tomas para mostrar: lista fija, o "desde las X" si el intervalo no cae siempre a la misma hora. */
export function timesTxt(m: Med) {
  if (m.schedule === 'interval' && !dividesDay(m.everyHours)) return `Primera toma: ${fmtTime(m.startTime)}`;
  return m.times.map(fmtTime).join(' · ');
}

export function durationTxt(m: Med) {
  if (m.durationDays == null) return 'De por vida';
  const last = lastDose(m);
  const ended = last && last < new Date();
  if (ended) return `Terminado (${m.durationDays} días)`;
  return `${m.durationDays} ${m.durationDays === 1 ? 'día' : 'días'}${last ? `, hasta el ${last.toLocaleDateString('es', { day: 'numeric', month: 'short' })}` : ''}`;
}

export const isFinished = (m: Med) => {
  const last = lastDose(m);
  return !!last && last.getTime() + MISSED_AFTER_MIN * 60e3 < Date.now();
};

/** Tomas de un medicamento en una fecha, ya filtradas por días de la semana y por la duración del tratamiento. */
export function medInstances(m: Med, dateKey: string): DoseInstance[] {
  const d = parseKey(dateKey);
  const mk = (t: string): DoseInstance => ({ key: ikey(dateKey, m.id, t), med: m, time: t, date: dateKey });
  if (m.schedule === 'interval') {
    // Cuenta las tomas de forma continua desde la primera: sirve para cualquier intervalo (5 h, 36 h…).
    const w = treatmentWindow(m);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86400e3;
    const step = m.everyHours * 3600e3;
    const out: DoseInstance[] = [];
    let k = Math.max(0, Math.ceil((dayStart - w.from.getTime()) / step));
    for (;; k++) {
      const at = nthDose(m, k);
      if (at.getTime() >= dayEnd || (w.to && at >= w.to)) break;
      if (at.getTime() >= dayStart) out.push(mk(hhmmOf(at)));
      if (out.length > 48) break;
    }
    return out;
  }
  if (!m.days.includes(d.getDay())) return [];
  return m.times.filter((t) => inTreatment(m, dateKey, t)).map(mk);
}

export function instancesFor(s: AppState, dateKey: string): DoseInstance[] {
  return s.meds.flatMap((m) => medInstances(m, dateKey)).sort((a, b) => tmin(a.time) - tmin(b.time));
}

export function findInstance(s: AppState, key: string): DoseInstance | null {
  const [date, medId, time] = key.split('|');
  const med = s.meds.find((m) => m.id === medId);
  return med ? { key, date, med, time } : null;
}

export function statusOf(s: AppState, inst: DoseInstance, now = new Date()): DoseStatus {
  const e = s.log[inst.key];
  if (e) return e.status;
  const today = dkey(now);
  if (inst.date < today) return 'missed';
  if (inst.date > today) return 'upcoming';
  const nm = now.getHours() * 60 + now.getMinutes();
  const t = tmin(inst.time);
  if (nm > t + MISSED_AFTER_MIN) return 'missed';
  if (nm >= t) return 'due';
  return 'upcoming';
}

export const STATUS_TXT: Record<DoseStatus, string> = {
  due: 'Pendiente',
  upcoming: 'Programada',
  taken: 'Tomada',
  proof: 'En espera de comprobante',
  missed: 'Olvidada',
  skipped: 'Omitida',
};

/** La dosis que la pantalla "Hoy" debe mostrar en grande. */
export function focusDose(s: AppState, now = new Date()): DoseInstance | null {
  const ins = instancesFor(s, dkey(now));
  const due = ins.find((i) => statusOf(s, i, now) === 'due');
  if (due) return due;
  const missed = ins.filter((i) => statusOf(s, i, now) === 'missed');
  if (missed.length) return missed[missed.length - 1];
  return ins.find((i) => statusOf(s, i, now) === 'upcoming') ?? null;
}

export function dayScore(s: AppState, dateKey: string) {
  const ins = instancesFor(s, dateKey);
  if (!ins.length) return null;
  let ok = 0;
  let bad = 0;
  for (const i of ins) {
    const st = statusOf(s, i);
    if (st === 'taken' || st === 'proof') ok++;
    else if (st === 'missed' || st === 'skipped') bad++;
  }
  return { ok, bad, total: ins.length };
}

/** Porcentaje de dosis cumplidas en los últimos `days` días (desde que se empezó a usar la app). */
export function adherence(s: AppState, days: number): number | null {
  let ok = 0;
  let total = 0;
  const d = new Date();
  const first = firstUseDate(s);
  for (let i = 0; i < days; i++) {
    const k = dkey(d);
    if (first && k < first) break;
    for (const x of instancesFor(s, k)) {
      const st = statusOf(s, x);
      if (st === 'upcoming' || st === 'due') continue;
      total++;
      if (st === 'taken' || st === 'proof') ok++;
    }
    d.setDate(d.getDate() - 1);
  }
  return total ? Math.round((ok * 100) / total) : null;
}

/** Primer día con actividad, para no contar como "olvidadas" fechas anteriores a instalar la app. */
export function firstUseDate(s: AppState): string | null {
  const keys = Object.keys(s.log).map((k) => k.split('|')[0]);
  if (s.createdAt) keys.push(s.createdAt);
  return keys.length ? keys.sort()[0] : null;
}

export function streak(s: AppState): number {
  let n = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const first = firstUseDate(s);
  for (let i = 0; i < 365; i++) {
    const k = dkey(d);
    if (first && k < first) break;
    const sc = dayScore(s, k);
    if (sc) {
      if (sc.bad === 0 && sc.ok === sc.total) n++;
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Dosis de hoy y de ayer que quedaron sin registrar y aún no se avisaron al cuidador. */
export function unalertedMissed(s: AppState, now = new Date()): DoseInstance[] {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const first = firstUseDate(s);
  return [dkey(y), dkey(now)]
    .filter((k) => !first || k >= first)
    .flatMap((k) => instancesFor(s, k))
    .filter((i) => statusOf(s, i, now) === 'missed' && !s.alerted[i.key]);
}

/** Completa los campos que faltan en medicamentos guardados por versiones anteriores de la app. */
export function normalizeMed(m: Partial<Med> & { id: string; name: string }, createdAt: string): Med {
  const times = m.times?.length ? m.times : ['08:00'];
  return {
    dose: '',
    qty: 1,
    note: '',
    type: 'pill',
    color: COLORS[0],
    days: [0, 1, 2, 3, 4, 5, 6],
    ...m,
    times,
    schedule: m.schedule ?? 'fixed',
    everyHours: m.everyHours ?? 8,
    startDate: m.startDate ?? createdAt,
    startTime: m.startTime ?? times[0],
    durationDays: m.durationDays === undefined ? null : m.durationDays,
  } as Med;
}

/** Tomas por día de media (para calcular cuántos días duran las pastillas). */
export function dosesPerDay(m: Med): number {
  if (m.schedule === 'interval') return 24 / m.everyHours;
  return (m.times.length * m.days.length) / 7;
}

/** Tomas que quedan del tratamiento desde ahora (null si es de por vida). */
export function remainingDoses(m: Med, now = new Date()): number | null {
  const total = totalDoses(m);
  if (total == null) return null;
  const last = lastDose(m);
  if (!last || last < now) return 0;
  const days = (last.getTime() - now.getTime()) / 86400e3;
  return Math.min(total, Math.ceil(days * dosesPerDay(m)) + 1);
}

/** Días de antelación con los que se avisa de que hay que comprar más. */
export const STOCK_ALERT_DAYS = 4;

export interface StockInfo {
  stock: number;
  daysLeft: number; // días que alcanzan las unidades disponibles
  low: boolean; // hay que comprar más
  out: boolean; // ya no queda
  unit: string; // "pastillas", "ml"…
}

/** Estado de las existencias de un medicamento, o null si no se lleva la cuenta. */
export function stockInfo(m: Med): StockInfo | null {
  if (m.stock == null || isFinished(m)) return null;
  const perDay = dosesPerDay(m) * (m.qty || 1);
  const daysLeft = perDay > 0 ? m.stock / perDay : Infinity;
  const need = remainingDoses(m);
  // Si las unidades alcanzan para lo que queda de tratamiento, no hace falta comprar más.
  const enough = need != null && m.stock >= need * (m.qty || 1);
  const unit = m.type === 'liquid' ? (m.qtyUnit ?? 'ml') : m.stock === 1 ? 'pastilla' : 'pastillas';
  return { stock: m.stock, daysLeft, low: !enough && daysLeft <= STOCK_ALERT_DAYS, out: m.stock <= 0, unit };
}

export const fmtStock = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** Edad en años cumplidos a partir de la fecha de nacimiento (YYYY-MM-DD). */
export function ageFrom(birthDate: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

export const fmtDateShort = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(k) ? k.split('-').reverse().join('/') : '');
export const SEX_TXT: Record<string, string> = { F: 'Mujer', M: 'Hombre', O: 'Otro', '': '' };
