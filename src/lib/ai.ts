import './polyfills';
import { GoogleAIBackend, Schema, getAI, getGenerativeModel, type Content } from 'firebase/ai';
import { DAY_ORDER, DAYS, adherence, doseTxt, dkey, fmtTime, freqTxt, instancesFor, statusOf, STATUS_TXT, streak, timesTxt, unitTxt } from './dose';
import { app } from './firebase';
import type { AppState, DoseInstance } from './types';

/**
 * IA gratuita: Gemini a través de Firebase AI Logic (Gemini Developer API, plan sin costo).
 * No hace falta clave en la app: la conexión va ligada al proyecto de Firebase.
 * Si un modelo deja de estar disponible, se prueba el siguiente de la lista.
 */
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
/** Espera máxima por modelo antes de probar el siguiente. */
const TIMEOUT_MS = 20_000;

const ai = getAI(app, { backend: new GoogleAIBackend() });

export class AiError extends Error {
  constructor(
    public code: 'network' | 'quota' | 'unavailable' | 'blocked' | 'other',
    message: string,
  ) {
    super(message);
  }
}

function mapError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const code = (e as { code?: string })?.code ?? '';
  const msg = String((e as { message?: string })?.message ?? '');
  if (code.includes('fetch-error') && /Failed to fetch|Network request failed/i.test(msg)) return new AiError('network', 'Sin conexión a internet. Inténtalo cuando tengas señal.');
  if (/high demand|overloaded|UNAVAILABLE/i.test(msg)) return new AiError('unavailable', 'La IA de Google está saturada en este momento. Inténtalo en unos minutos o registra la toma sin foto.');
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return new AiError('quota', 'Se alcanzó el límite gratuito de consultas por ahora. Inténtalo más tarde o registra la toma sin foto.');
  if (/App Check/i.test(msg)) return new AiError('unavailable', 'La IA está bloqueada por la verificación de apps (App Check) del proyecto. Hay que desactivarla en la consola de Firebase.');
  if (code.includes('api-not-enabled') || /not enabled|PERMISSION_DENIED|403/i.test(msg)) return new AiError('unavailable', 'La IA no está activada en el proyecto de Firebase.');
  if (/SAFETY|blocked/i.test(msg)) return new AiError('blocked', 'La IA no pudo revisar esta foto. Registra la toma sin foto.');
  return new AiError('other', 'La IA no respondió. Inténtalo de nuevo o registra la toma sin foto.');
}

/** Errores con los que conviene probar el siguiente modelo: no existe, saturado o tardó demasiado. */
const tryNext = (e: unknown) =>
  /404|not found|is not supported|NOT_FOUND|no longer available|high demand|overloaded|UNAVAILABLE|\b50[03]\b|timeout|timed out|aborted/i.test(
    `${(e as { code?: string })?.code ?? ''} ${(e as { message?: string })?.message ?? ''}`,
  );

/** Ejecuta la consulta con el primer modelo disponible. */
async function withModel<T>(fn: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const m of MODELS) {
    try {
      return await fn(m);
    } catch (e) {
      last = e;
      if (!tryNext(e)) break;
    }
  }
  throw mapError(last);
}

export interface Verdict {
  verificado: boolean;
  confianza: number;
  medicamento_detectado: string;
  explicacion: string;
}

const VERDICT_SCHEMA = Schema.object({
  properties: {
    verificado: Schema.boolean(),
    confianza: Schema.integer({ description: '0 a 100' }),
    medicamento_detectado: Schema.string({ description: 'Nombre leído en el envase, o "desconocido"' }),
    explicacion: Schema.string({ description: 'Una frase breve en español dirigida al paciente' }),
  },
});

export function verifyPrompt(inst: DoseInstance) {
  const m = inst.med;
  return `Eres el verificador de una app de recordatorio de medicamentos para una persona mayor. El paciente dice que acaba de tomar:
- Medicamento: ${m.name}
- Dosis: ${doseTxt(m)} (${m.qty} ${unitTxt(m)})
- Forma: ${m.type === 'liquid' ? 'líquido (jarabe, gotas o solución)' : 'pastilla o cápsula'}
Como comprobante se le pidió una foto del blíster con el hueco vacío, de la caja o frasco, o del envase vacío.

Decide si la foto es un comprobante razonable de esta toma:
- Acepta si se ve un blíster o envase de medicamento con al menos un hueco vacío, o un envase coherente con el medicamento esperado.
- Rechaza si se lee claramente el nombre de OTRO medicamento, o si la foto no muestra ningún medicamento ni envase.
- Si la foto está borrosa u oscura y no se puede saber, rechaza y pide repetirla con más luz.
La explicación debe ser amable, en español, de una frase, y decir qué hacer si se rechaza.`;
}

export async function verifyPhoto(inst: DoseInstance, jpegBase64: string): Promise<Verdict> {
  return withModel(async (name) => {
    const model = getGenerativeModel(ai, {
      model: name,
      generationConfig: { responseMimeType: 'application/json', responseSchema: VERDICT_SCHEMA, temperature: 0.2 },
    }, { timeout: TIMEOUT_MS });
    const res = await model.generateContent([verifyPrompt(inst), { type: 'inlineData', inlineData: { mimeType: 'image/jpeg', data: jpegBase64 } }]);
    const v = JSON.parse(res.response.text()) as Verdict;
    v.confianza = Math.max(0, Math.min(100, Math.round(Number(v.confianza) || 0)));
    v.explicacion = String(v.explicacion ?? '').trim();
    return v;
  });
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

function patientContext(s: AppState) {
  const now = new Date();
  const lines: string[] = [];
  lines.push(`Fecha y hora actual: ${now.toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false })}`);
  if (s.settings.patientName) lines.push(`Paciente: ${s.settings.patientName}`);
  lines.push('Medicamentos configurados:');
  if (!s.meds.length) lines.push('- (ninguno todavía)');
  for (const m of s.meds)
    lines.push(
      `- ${m.name} ${doseTxt(m)}, ${m.qty} ${unitTxt(m)}, ${timesTxt(m)}, ${freqTxt(m)}, empezó el ${m.startDate}${m.schedule === 'fixed' ? `, días: ${DAY_ORDER.filter((x) => m.days.includes(x)).map((x) => DAYS[x]).join(' ')}` : ''}${m.note ? `, nota: ${m.note}` : ''}`,
    );
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (s.createdAt && dkey(d) < s.createdAt) break;
    const ins = instancesFor(s, dkey(d));
    if (!ins.length) continue;
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : d.toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
    lines.push(`${label}: ${ins.map((x) => `${x.med.name} ${fmtTime(x.time)} = ${STATUS_TXT[statusOf(s, x)]}${s.log[x.key]?.verified ? ' (verificada con foto)' : ''}`).join('; ')}`);
  }
  const a7 = adherence(s, 7);
  lines.push(`Cumplimiento de los últimos 7 días: ${a7 == null ? 'sin datos' : `${a7}%`}. Días seguidos completos: ${streak(s)}.`);
  return lines.join('\n');
}

export async function askAssistant(s: AppState, turns: ChatTurn[]): Promise<string> {
  const system = `Eres el asistente de SaludAsist, una app que ayuda a una persona a tomar su medicación a tiempo. Habla en español, con calidez, frases cortas y sin tecnicismos: quien te lee puede ser una persona mayor o un familiar que la cuida. Responde en 5 frases como máximo o una lista breve, sin formato markdown.

Usa solo los datos del paciente que siguen para hablar de sus tomas. No inventes medicamentos ni dosis. No recomiendes cambiar, duplicar ni suspender una dosis: para eso remite al médico o farmacéutico. Si se olvidó una dosis, sugiere consultar el prospecto o al farmacéutico antes de tomarla tarde. Ante síntomas graves, indica llamar a emergencias o acudir al médico.

Datos del paciente:
${patientContext(s)}`;
  const history: Content[] = turns.slice(-12, -1).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ type: 'text' as const, text: t.content }] }));
  const last = turns[turns.length - 1]?.content ?? '';
  return withModel(async (name) => {
    const model = getGenerativeModel(ai, { model: name, systemInstruction: system, generationConfig: { temperature: 0.4 } }, { timeout: TIMEOUT_MS });
    const chat = model.startChat({ history });
    const res = await chat.sendMessage(last);
    return res.response.text().trim();
  });
}

/** Datos que la IA lee en la caja o el frasco de un medicamento. */
export interface BoxInfo {
  nombre: string;
  dosis_cantidad: string; // "500", "2,5"; vacío si no se lee
  dosis_unidad: string; // mg, g, mcg, UI, ml, gotas, cucharadas, mg/ml
  tipo: 'pill' | 'liquid';
  unidades_caja: number; // comprimidos o ml que trae; 0 si no se lee
  legible: boolean;
}

const BOX_SCHEMA = Schema.object({
  properties: {
    legible: Schema.boolean({ description: 'true si se ve un envase de medicamento y se puede leer su nombre' }),
    nombre: Schema.string({ description: 'Nombre comercial o principio activo, como aparece en el envase. Vacío si no se lee.' }),
    dosis_cantidad: Schema.string({ description: 'Solo el número de la concentración por unidad (p. ej. "500" o "2,5"). Vacío si no se lee.' }),
    dosis_unidad: Schema.enumString({ enum: ['mg', 'g', 'mcg', 'UI', 'ml', 'gotas', 'cucharadas', 'mg/ml'] }),
    tipo: Schema.enumString({ enum: ['pill', 'liquid'], description: 'pill: comprimidos, cápsulas, grageas. liquid: jarabe, gotas, solución, suspensión.' }),
    unidades_caja: Schema.integer({ description: 'Comprimidos o cápsulas que trae (o ml del frasco). 0 si no se lee.' }),
  },
});

/** Lee la caja o el frasco de un medicamento para rellenar el formulario. */
export async function readMedBox(jpegBase64: string): Promise<BoxInfo> {
  const prompt = `Eres el asistente de una app de recordatorio de medicamentos. La foto muestra la caja, el blíster o el frasco de un medicamento.
Lee los datos impresos y devuélvelos para rellenar el formulario:
- nombre: el nombre del medicamento tal como aparece (marca o principio activo), sin la dosis.
- dosis_cantidad y dosis_unidad: la concentración por comprimido o por dosis (p. ej. 500 mg). En jarabes suele expresarse en mg/ml o mg/5 ml: usa mg/ml si aparece así.
- tipo: pill si son comprimidos o cápsulas; liquid si es jarabe, gotas, solución o suspensión.
- unidades_caja: cuántos comprimidos o cápsulas trae, o cuántos ml tiene el frasco.
No inventes datos: si algo no se lee con claridad, déjalo vacío (o 0). Si la foto no muestra un medicamento, marca legible = false.`;
  return withModel(async (name) => {
    const model = getGenerativeModel(
      ai,
      { model: name, generationConfig: { responseMimeType: 'application/json', responseSchema: BOX_SCHEMA, temperature: 0.1 } },
      { timeout: TIMEOUT_MS },
    );
    const res = await model.generateContent([prompt, { type: 'inlineData', inlineData: { mimeType: 'image/jpeg', data: jpegBase64 } }]);
    const v = JSON.parse(res.response.text()) as BoxInfo;
    return {
      legible: !!v.legible,
      nombre: String(v.nombre ?? '').trim(),
      dosis_cantidad: String(v.dosis_cantidad ?? '').replace(/[^0-9.,]/g, ''),
      dosis_unidad: String(v.dosis_unidad ?? ''),
      tipo: v.tipo === 'liquid' ? 'liquid' : 'pill',
      unidades_caja: Math.max(0, Math.round(Number(v.unidades_caja) || 0)),
    };
  });
}
