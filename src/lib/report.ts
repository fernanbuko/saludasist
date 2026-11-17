import { ageFrom, dkey, doseTxt, fmtDateShort, fmtTime, freqTxt, instancesFor, parseKey, SEX_TXT, statusOf, timesTxt, unitTxt } from './dose';
import type { AppState, DoseStatus, Med, PatientProfile } from './types';

/**
 * Informe para el médico: resumen de un periodo con los medicamentos, el cumplimiento
 * y las tomas olvidadas u omitidas. Se genera como texto (para compartir por WhatsApp o correo)
 * y como HTML (para el PDF).
 */

export interface MedSummary {
  med: Med;
  scheduled: number;
  taken: number;
  verified: number;
  missed: number;
  skipped: number;
}

export interface Incident {
  date: string;
  time: string;
  med: string;
  status: 'missed' | 'skipped';
}

export interface Report {
  patient: string;
  profile: PatientProfile | null;
  from: string;
  to: string;
  days: number;
  scheduled: number;
  taken: number;
  verified: number;
  missed: number;
  skipped: number;
  adherence: number | null;
  meds: MedSummary[];
  incidents: Incident[];
  daily: { date: string; taken: number; scheduled: number }[];
}

const fmtDay = (k: string) => parseKey(k).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = (k: string) => parseKey(k).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

export function buildReport(s: AppState, days: number, profile: PatientProfile | null = null, now = new Date()): Report {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  let from = dkey(start);
  if (s.createdAt && s.createdAt > from) from = s.createdAt;
  const to = dkey(now);

  const byMed = new Map<string, MedSummary>();
  const incidents: Incident[] = [];
  const daily: Report['daily'] = [];
  const d = parseKey(from);
  while (dkey(d) <= to) {
    const k = dkey(d);
    let dayTaken = 0;
    let dayScheduled = 0;
    for (const i of instancesFor(s, k)) {
      const st: DoseStatus = statusOf(s, i, now);
      if (st === 'upcoming' || st === 'due') continue; // aún no ha llegado la hora
      const sum = byMed.get(i.med.id) ?? { med: i.med, scheduled: 0, taken: 0, verified: 0, missed: 0, skipped: 0 };
      sum.scheduled++;
      dayScheduled++;
      if (st === 'taken' || st === 'proof') {
        sum.taken++;
        dayTaken++;
        if (s.log[i.key]?.verified) sum.verified++;
      } else if (st === 'missed' || st === 'skipped') {
        sum[st]++;
        incidents.push({ date: k, time: i.time, med: `${i.med.name} ${doseTxt(i.med)}`, status: st });
      }
      byMed.set(i.med.id, sum);
    }
    if (dayScheduled) daily.push({ date: k, taken: dayTaken, scheduled: dayScheduled });
    d.setDate(d.getDate() + 1);
  }
  const meds = [...byMed.values()];
  const tot = (f: keyof Omit<MedSummary, 'med'>) => meds.reduce((a, m) => a + m[f], 0);
  const scheduled = tot('scheduled');
  const taken = tot('taken');
  return {
    patient: profile?.fullName || s.settings.patientName || 'Paciente',
    profile,
    from,
    to,
    days,
    scheduled,
    taken,
    verified: tot('verified'),
    missed: tot('missed'),
    skipped: tot('skipped'),
    adherence: scheduled ? Math.round((taken * 100) / scheduled) : null,
    meds,
    incidents: incidents.reverse(),
    daily,
  };
}

/** Líneas con los datos del paciente: [etiqueta, valor], solo las que tienen dato. */
export function patientLines(r: Report): [string, string][] {
  const p = r.profile;
  const age = p ? ageFrom(p.birthDate) : null;
  const out: [string, string][] = [['Paciente', r.patient]];
  if (age != null) out.push(['Edad', `${age} años (nacimiento: ${fmtDateShort(p!.birthDate)})`]);
  if (p?.sex) out.push(['Sexo', SEX_TXT[p.sex]]);
  if (p?.allergies) out.push(['Alergias', p.allergies]);
  if (p?.conditions) out.push(['Enfermedades o condiciones', p.conditions]);
  if (p?.doctor) out.push(['Médico o centro', p.doctor]);
  if (p?.emergencyName || p?.emergencyPhone) out.push(['Contacto de emergencia', [p.emergencyName, p.emergencyPhone].filter(Boolean).join(' · ')]);
  return out;
}

/** Nombre del archivo PDF: Informe_Carmen_Lopez_2026-11-17.pdf */
export function reportFileName(r: Report) {
  const name = r.patient
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Informe_${name || 'Paciente'}_${r.to}.pdf`;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : '—');

export function reportText(r: Report): string {
  const lines: string[] = [];
  lines.push('INFORME DE MEDICACIÓN');
  for (const [k, v] of patientLines(r)) lines.push(`${k}: ${v}`);
  lines.push(`Periodo: del ${fmtLong(r.from)} al ${fmtLong(r.to)}`);
  lines.push('');
  lines.push(`Cumplimiento: ${r.adherence == null ? 'sin datos' : `${r.adherence}%`} (${r.taken} de ${r.scheduled} tomas)`);
  lines.push(`Verificadas con foto: ${r.verified} · Olvidadas: ${r.missed} · Omitidas: ${r.skipped}`);
  lines.push('');
  lines.push('MEDICAMENTOS');
  for (const m of r.meds)
    lines.push(`• ${m.med.name} ${doseTxt(m.med)} — ${m.med.qty} ${unitTxt(m.med)} — ${freqTxt(m.med)} (${timesTxt(m.med)}). Cumplimiento: ${pct(m.taken, m.scheduled)} (${m.taken}/${m.scheduled})`);
  if (r.incidents.length) {
    lines.push('');
    lines.push('TOMAS NO REALIZADAS');
    for (const i of r.incidents.slice(0, 40)) lines.push(`• ${fmtDay(i.date)} ${fmtTime(i.time)} — ${i.med} — ${i.status === 'missed' ? 'olvidada' : 'omitida'}`);
    if (r.incidents.length > 40) lines.push(`… y ${r.incidents.length - 40} más.`);
  }
  lines.push('');
  lines.push('Generado con SaludAsist. Los datos los registra el propio paciente o su familia.');
  return lines.join('\n');
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function reportHtml(r: Report): string {
  const medRows = r.meds
    .map(
      (m) => `<tr><td><b>${esc(m.med.name)}</b><br><span class="sub">${esc(doseTxt(m.med))} · ${m.med.qty} ${esc(unitTxt(m.med))}</span></td>
        <td>${esc(freqTxt(m.med))}<br><span class="sub">${esc(timesTxt(m.med))}</span></td>
        <td class="num">${m.taken}/${m.scheduled}</td><td class="num"><b>${pct(m.taken, m.scheduled)}</b></td><td class="num">${m.verified}</td></tr>`,
    )
    .join('');
  const incRows = r.incidents
    .slice(0, 60)
    .map((i) => `<tr><td>${esc(fmtDay(i.date))}</td><td class="num">${fmtTime(i.time)}</td><td>${esc(i.med)}</td><td class="${i.status}">${i.status === 'missed' ? 'Olvidada' : 'Omitida'}</td></tr>`)
    .join('');
  const bars = r.daily
    .map((d) => {
      const p = d.scheduled ? d.taken / d.scheduled : 0;
      const color = p >= 1 ? '#3E9B4F' : p >= 0.5 ? '#D9822B' : '#C94040';
      return `<div class="bar" title="${esc(fmtDay(d.date))}"><div style="height:${Math.max(4, p * 60)}px;background:${color}"></div><span>${parseKey(d.date).getDate()}</span></div>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1C2B3D;margin:28px;font-size:12px}
  h1{color:#3A6EA5;font-size:22px;margin:0 0 4px}
  h2{font-size:15px;margin:22px 0 8px;color:#2B5687;border-bottom:2px solid #D3E0EF;padding-bottom:4px}
  .sub{color:#5B6E85;font-size:11px}
  .kpis{display:flex;gap:10px;margin-top:14px}
  .kpi{flex:1;background:#F3F7FC;border-radius:8px;padding:10px;text-align:center}
  .kpi b{display:block;font-size:22px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px;border-bottom:1px solid #E3EBF5;vertical-align:top}
  th{background:#F3F7FC;font-size:11px;color:#5B6E85}
  .num{text-align:right;white-space:nowrap}
  .missed{color:#C94040;font-weight:bold}.skipped{color:#D9822B;font-weight:bold}
  .bars{display:flex;align-items:flex-end;gap:3px;height:80px}
  .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
  .bar div{width:100%;border-radius:2px}.bar span{font-size:8px;color:#5B6E85}
  .foot{margin-top:24px;color:#5B6E85;font-size:10px}
  .patient{margin-top:12px;border:1px solid #D3E0EF;border-radius:8px}
  .patient th{width:190px;background:#F3F7FC;color:#2B5687;font-size:11px}
  .patient td{font-size:13px}
  .allergy{color:#C94040;font-weight:bold}
  </style></head><body>
  <h1>Informe de medicación</h1>
  <div class="sub">Periodo: del ${esc(fmtLong(r.from))} al ${esc(fmtLong(r.to))}</div>
  <table class="patient">${patientLines(r)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td${k === 'Alergias' ? ' class="allergy"' : ''}>${esc(v)}</td></tr>`)
    .join('')}</table>
  <div class="kpis">
    <div class="kpi"><b>${r.adherence == null ? '—' : `${r.adherence}%`}</b>Cumplimiento</div>
    <div class="kpi"><b>${r.taken}/${r.scheduled}</b>Tomas realizadas</div>
    <div class="kpi"><b>${r.verified}</b>Verificadas con foto</div>
    <div class="kpi"><b>${r.missed}</b>Olvidadas</div>
    <div class="kpi"><b>${r.skipped}</b>Omitidas</div>
  </div>
  <h2>Cumplimiento diario</h2>
  <div class="bars">${bars || '<span class="sub">Sin tomas en el periodo.</span>'}</div>
  <h2>Medicamentos</h2>
  <table><tr><th>Medicamento</th><th>Pauta</th><th class="num">Tomas</th><th class="num">Cumpl.</th><th class="num">Con foto</th></tr>${medRows || '<tr><td colspan="5" class="sub">Sin medicamentos en el periodo.</td></tr>'}</table>
  <h2>Tomas no realizadas</h2>
  ${incRows ? `<table><tr><th>Día</th><th class="num">Hora</th><th>Medicamento</th><th>Estado</th></tr>${incRows}</table>` : '<div class="sub">Ninguna: se registraron todas las tomas del periodo.</div>'}
  <div class="foot">Generado con SaludAsist el ${esc(new Date().toLocaleString('es', { hour12: false }))}. Los datos los registra el propio paciente o su familia; «verificada con foto» indica que una IA revisó la foto del envase.</div>
  </body></html>`;
}
