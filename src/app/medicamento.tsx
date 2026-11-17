import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../components/art';
import { Btn, Card, Header, ScreenTitle, s } from '../components/ui';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AiError, readMedBox } from '../lib/ai';
import { COLORS, DAY_ORDER, DAYS, INTERVALS, LIQUID_QTY_UNITS, unitsFor, parseDose, MAX_INTERVAL_H, MIN_INTERVAL_H, dividesDay, dkey, doseDate, everyTxt, fmtDate, fmtTime, hhmmOf, intervalTimes, lastDose, newId, totalDoses } from '../lib/dose';
import { useApp } from '../lib/store';
import type { Med, MedType, ScheduleMode } from '../lib/types';
import { C } from '../theme';

const pad = (n: number) => String(n).padStart(2, '0');
const QUICK_DAYS = [3, 5, 7, 10, 14, 30];


export default function Medicamento() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, saveMed, deleteMed } = useApp();
  const existing = id ? state.meds.find((m) => m.id === id) : undefined;
  const today = dkey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dkey(tomorrowDate);

  const [name, setName] = useState(existing?.name ?? '');
  const initialDose = parseDose(existing?.dose ?? '', existing?.type ?? 'pill');
  const [doseAmount, setDoseAmount] = useState(initialDose.amount);
  const [doseUnit, setDoseUnit] = useState(initialDose.unit);
  const [qty, setQty] = useState(String(existing?.qty ?? 1));
  const [mode, setMode] = useState<ScheduleMode>(existing?.schedule ?? 'interval');
  const [everyStr, setEveryStr] = useState(String(existing?.everyHours ?? 8));
  const [startTime, setStartTime] = useState(existing?.startTime ?? '08:00');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [lifelong, setLifelong] = useState(existing ? existing.durationDays == null : false);
  const [daysTxt, setDaysTxt] = useState(String(existing?.durationDays ?? 7));
  const [times, setTimes] = useState<string[]>(existing?.schedule === 'fixed' ? existing.times : ['08:00']);
  const [days, setDays] = useState<number[]>(existing?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [note, setNote] = useState(existing?.note ?? '');
  const [type, setType] = useState<MedType>(existing?.type ?? 'pill');
  const [qtyUnit, setQtyUnit] = useState(existing?.qtyUnit ?? 'ml');
  const [stockTxt, setStockTxt] = useState(existing?.stock != null ? String(existing.stock) : '');
  const [scan, setScan] = useState<{ busy: boolean; msg: string; ok?: boolean }>({ busy: false, msg: '' });

  /** Foto de la caja → la IA rellena nombre, dosis, tipo y unidades. */
  const scanBox = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setScan({ busy: false, msg: 'Sin permiso para usar la cámara. Actívalo en los ajustes del teléfono.' });
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
    if (r.canceled || !r.assets?.[0]) return;
    setScan({ busy: true, msg: 'Leyendo la caja…' });
    try {
      const a = r.assets[0];
      const ref = await ImageManipulator.manipulate(a.uri).resize(a.width >= a.height ? { width: 1280 } : { height: 1280 }).renderAsync();
      const out = await ref.saveAsync({ base64: true, compress: 0.75, format: SaveFormat.JPEG });
      const box = await readMedBox(out.base64 ?? '');
      if (!box.legible || !box.nombre) {
        setScan({ busy: false, msg: 'No pude leer la caja. Prueba con más luz, de frente y que se vea bien el nombre.' });
        return;
      }
      const t: MedType = box.tipo;
      setType(t);
      setName(box.nombre);
      if (box.dosis_cantidad) setDoseAmount(box.dosis_cantidad);
      setDoseUnit(unitsFor(t).includes(box.dosis_unidad) ? box.dosis_unidad : unitsFor(t)[0]);
      if (t === 'liquid') setQtyUnit('ml');
      if (box.unidades_caja > 0 && !stockTxt) setStockTxt(String(box.unidades_caja));
      const parts = [box.nombre, box.dosis_cantidad ? `${box.dosis_cantidad} ${box.dosis_unidad}` : '', box.unidades_caja ? `${box.unidades_caja} ${t === 'liquid' ? 'ml' : 'unidades'}` : ''].filter(Boolean);
      setScan({ busy: false, ok: true, msg: `Leído: ${parts.join(' · ')}. Revisa los datos y completa el horario.` });
    } catch (e) {
      setScan({ busy: false, msg: e instanceof AiError ? e.message : 'No se pudo leer la caja. Inténtalo de nuevo o escribe los datos.' });
    }
  };
  /** Al cambiar entre pastilla y líquido, la unidad de la dosis pasa a una que corresponda al tipo. */
  const changeType = (t: MedType) => {
    setType(t);
    if (!unitsFor(t).includes(doseUnit)) setDoseUnit(unitsFor(t)[0]);
  };
  const [color, setColor] = useState(existing?.color ?? COLORS[state.meds.length % COLORS.length]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const everyHours = parseInt(everyStr, 10);
  const validEvery = Number.isFinite(everyHours) && everyHours >= MIN_INTERVAL_H && everyHours <= MAX_INTERVAL_H;
  const durationDays = lifelong ? null : parseInt(daysTxt, 10);
  const validDuration = lifelong || (Number.isFinite(durationDays) && (durationDays as number) >= 1 && (durationDays as number) <= 3650);
  const computedTimes = mode === 'interval' ? intervalTimes(startTime, validEvery ? everyHours : 8) : [...new Set(times)].sort();

  // Borrador con lo que hay en pantalla, para mostrar el resumen (nº de tomas y última toma).
  const draft: Med = {
    id: existing?.id ?? 'draft',
    name: name.trim(),
    dose: doseAmount ? `${doseAmount} ${doseUnit}` : '—',
    qty: parseFloat(qty.replace(',', '.')) || 1,
    qtyUnit: type === 'liquid' ? qtyUnit : undefined,
    // Vacío = no llevar la cuenta de las unidades disponibles.
    stock: stockTxt.trim() === '' ? null : Math.max(0, parseFloat(stockTxt.replace(',', '.')) || 0),
    stockAlertedOn: stockTxt.trim() !== '' && existing?.stock != null && parseFloat(stockTxt.replace(',', '.')) === existing.stock ? existing.stockAlertedOn : undefined,
    schedule: mode,
    everyHours: validEvery ? everyHours : 8,
    startDate,
    startTime: mode === 'interval' ? startTime : computedTimes[0] ?? '08:00',
    durationDays: validDuration ? durationDays : null,
    times: computedTimes,
    days: mode === 'interval' ? [0, 1, 2, 3, 4, 5, 6] : [...days].sort(),
    note: note.trim(),
    type,
    color,
  };
  const total = validDuration && !lifelong ? totalDoses(draft) : null;
  const last = validDuration && !lifelong ? lastDose(draft) : null;

  const save = () => {
    const problems: string[] = [];
    if (!name.trim()) problems.push('escribe el nombre');
    if (!doseAmount) problems.push('escribe la dosis (por ejemplo 500 mg)');
    if (mode === 'fixed' && !days.length) problems.push('elige al menos un día');
    if (!(parseFloat(qty.replace(',', '.')) > 0)) problems.push('indica cuántas pastillas o ml');
    if (!validDuration) problems.push('indica cuántos días (de 1 a 3650)');
    if (mode === 'interval' && !validEvery) problems.push(`indica cada cuántas horas (de ${MIN_INTERVAL_H} a ${MAX_INTERVAL_H})`);
    if (problems.length) {
      setError(`Para guardar, ${problems.join(' y ')}.`);
      return;
    }
    saveMed({ ...draft, id: existing?.id ?? newId() });
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="SaludAsist" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
          <ScreenTitle>Configuración de meds</ScreenTitle>
          <Card style={{ backgroundColor: C.surface2 }}>
            <Btn icon="camera" title={scan.busy ? 'Leyendo la caja…' : 'Escanear la caja'} loading={scan.busy} onPress={scanBox} />
            <Text style={s.sub}>
              {scan.msg || 'Saca una foto de la caja o el frasco y la IA rellenará el nombre, la dosis y cuántas unidades trae.'}
            </Text>
            {scan.ok === true && <Text style={{ color: C.ok, fontWeight: '700' }}>✓ Datos rellenados</Text>}
          </Card>
          <Card>
            <Field label="Nombre">
              <TextInput style={st.input} value={name} onChangeText={setName} placeholder="Ej. Amoxicilina" autoCapitalize="sentences" />
            </Field>
            <Field label="Tipo de medicamento">
              <View style={st.chips}>
                <Chip on={type === 'pill'} label="Pastilla" onPress={() => changeType('pill')} />
                <Chip on={type === 'liquid'} label="Líquido" onPress={() => changeType('liquid')} />
              </View>
            </Field>
            <Field label="Dosis (cantidad de medicamento)">
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[st.input, { width: 110, textAlign: 'center', fontSize: 18, fontWeight: '800' }]}
                  value={doseAmount}
                  onChangeText={(t) => setDoseAmount(t.replace(/[^0-9.,]/g, ''))}
                  placeholder="500"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Cantidad de la dosis"
                />
                <Text style={{ color: C.fg, fontSize: 18, fontWeight: '800' }}>{doseUnit}</Text>
              </View>
              <View style={st.chips}>
                {unitsFor(type).map((u) => (
                  <Chip key={u} on={doseUnit === u} label={u} onPress={() => setDoseUnit(u)} />
                ))}
              </View>
            </Field>
            <Field label="¿Cuántas toma cada vez?">
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput style={[st.input, { width: 72, textAlign: 'center' }]} value={qty} onChangeText={setQty} keyboardType="decimal-pad" accessibilityLabel="Cuántas toma cada vez" />
                <Text style={{ color: C.fg }}>{type === 'liquid' ? qtyUnit : 'pastilla(s)'}</Text>
              </View>
              {type === 'liquid' && (
                <View style={st.chips}>
                  {LIQUID_QTY_UNITS.map((u) => (
                    <Chip key={u} on={qtyUnit === u} label={u} onPress={() => setQtyUnit(u)} />
                  ))}
                </View>
              )}
            </Field>
            <Field label={type === 'liquid' ? `¿Cuánto te queda? (${qtyUnit})` : '¿Cuántas pastillas te quedan?'}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[st.input, { width: 90, textAlign: 'center', fontSize: 18, fontWeight: '800' }]}
                  value={stockTxt}
                  onChangeText={(t) => setStockTxt(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  accessibilityLabel="Unidades disponibles"
                />
                <Text style={{ color: C.fg }}>{type === 'liquid' ? qtyUnit : 'pastillas'}</Text>
              </View>
              <View style={st.chips}>
                {[10, 20, 30].map((n) => (
                  <Chip key={n} on={false} label={`+${n}`} onPress={() => setStockTxt(String((parseFloat(stockTxt.replace(',', '.')) || 0) + n))} />
                ))}
                {!!stockTxt && <Chip on={false} label="No llevar la cuenta" onPress={() => setStockTxt('')} />}
              </View>
              <Text style={s.sub}>Opcional. Se descuentan con cada toma y te aviso cuando queden para menos de 4 días.</Text>
            </Field>
          </Card>

          <Card>
            <Field label="¿Durante cuánto tiempo?">
              <View style={st.chips}>
                <Chip on={!lifelong} label="Por días" onPress={() => setLifelong(false)} />
                <Chip on={lifelong} label="De por vida" onPress={() => setLifelong(true)} />
              </View>
            </Field>
            {!lifelong && (
              <Field label="Número de días">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput style={[st.input, { width: 90, textAlign: 'center', fontSize: 18, fontWeight: '800' }]} value={daysTxt} onChangeText={(t) => setDaysTxt(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Número de días" maxLength={4} />
                  <Text style={{ color: C.fg, fontSize: 16 }}>días</Text>
                </View>
                <View style={st.chips}>
                  {QUICK_DAYS.map((n) => (
                    <Chip key={n} on={daysTxt === String(n)} label={`${n}`} onPress={() => setDaysTxt(String(n))} />
                  ))}
                </View>
              </Field>
            )}
            <Field label="Empieza">
              <View style={st.chips}>
                <Chip on={startDate === today} label="Hoy" onPress={() => setStartDate(today)} />
                <Chip on={startDate === tomorrow} label="Mañana" onPress={() => setStartDate(tomorrow)} />
                {startDate !== today && startDate !== tomorrow && <Chip on label={startDate.split('-').reverse().join('/')} onPress={() => {}} />}
              </View>
            </Field>
          </Card>

          <Card>
            <Field label="¿Cómo se toma?">
              <View style={st.chips}>
                <Chip on={mode === 'interval'} label="Cada X horas" onPress={() => setMode('interval')} />
                <Chip on={mode === 'fixed'} label="Horas concretas" onPress={() => setMode('fixed')} />
              </View>
            </Field>

            {mode === 'interval' ? (
              <>
                <Field label="Hora de la primera toma">
                  <TimeField value={startTime} onChange={setStartTime} />
                </Field>
                <Field label="Cada cuántas horas">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: C.fg, fontSize: 16 }}>Cada</Text>
                    <TextInput
                      style={[st.input, { width: 80, textAlign: 'center', fontSize: 18, fontWeight: '800' }, !validEvery && { borderColor: C.bad }]}
                      value={everyStr}
                      onChangeText={(t) => setEveryStr(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessibilityLabel="Cada cuántas horas"
                    />
                    <Text style={{ color: C.fg, fontSize: 16 }}>horas</Text>
                  </View>
                  <View style={st.chips}>
                    {INTERVALS.map((h) => (
                      <Chip key={h} on={everyStr === String(h)} label={everyTxt(h)} onPress={() => setEveryStr(String(h))} />
                    ))}
                  </View>
                  {!validEvery && <Text style={{ color: C.bad }}>Escribe un número de {MIN_INTERVAL_H} a {MAX_INTERVAL_H} horas.</Text>}
                </Field>
              </>
            ) : (
              <>
                <Field label="Horas">
                  <View style={{ gap: 8 }}>
                    {times.map((t, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <TimeField value={t} onChange={(v) => setTimes((ts) => ts.map((x, j) => (j === i ? v : x)))} />
                        </View>
                        {times.length > 1 && (
                          <Pressable accessibilityLabel="Quitar hora" hitSlop={8} onPress={() => setTimes((ts) => ts.filter((_, j) => j !== i))}>
                            <Icon name="x" color={C.muted} size={18} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    <Chip on={false} label="+ Añadir hora" onPress={() => setTimes((ts) => [...ts, '20:00'])} />
                  </View>
                </Field>
                <Field label="Días de la semana">
                  <View style={st.chips}>
                    {DAY_ORDER.map((d) => (
                      <Chip key={d} on={days.includes(d)} label={DAYS[d]} onPress={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))} />
                    ))}
                  </View>
                </Field>
              </>
            )}

            <View style={st.summary}>
              <Text style={st.summaryTitle}>Tomas calculadas</Text>
              {mode === 'interval' && validEvery && !dividesDay(everyHours) ? (
                <>
                  <Text style={st.summaryText}>{everyTxt(everyHours)} desde las {fmtTime(startTime)}</Text>
                  <Text style={s.sub}>Primeras tomas: {firstDoses(startDate, startTime, everyHours, 5).join(' · ')}…</Text>
                  <Text style={s.sub}>Como {everyHours} h no cabe exacto en un día, la hora de las tomas cambia de un día a otro.</Text>
                </>
              ) : (
                <Text style={st.summaryText}>{computedTimes.map(fmtTime).join(' · ')}</Text>
              )}
              {lifelong ? (
                <Text style={s.sub}>
                  {mode === 'interval' && !dividesDay(everyHours) ? 'Sin fecha de fin.' : `${computedTimes.length} ${computedTimes.length === 1 ? 'toma' : 'tomas'} al día, sin fecha de fin.`}
                </Text>
              ) : validDuration ? (
                <Text style={s.sub}>
                  {total} {total === 1 ? 'toma' : 'tomas'} en total
                  {last ? `. La última: ${fmtDate(last)} a las ${fmtTime(`${pad(last.getHours())}:${pad(last.getMinutes())}`)}.` : '.'}
                </Text>
              ) : (
                <Text style={[s.sub, { color: C.bad }]}>Escribe cuántos días dura el tratamiento.</Text>
              )}
            </View>
          </Card>

          <Card>
            <Field label="Añadir nota">
              <TextInput style={st.input} value={note} onChangeText={setNote} placeholder="Ej. con comida" />
            </Field>
            <Field label="Color">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {COLORS.map((c) => (
                  <Pressable key={c} accessibilityLabel={`Color ${c}`} onPress={() => setColor(c)} style={[st.swatch, { backgroundColor: c }, color === c && { borderColor: C.fg }]} />
                ))}
              </View>
            </Field>
            {!!error && <Text style={{ color: C.bad }}>{error}</Text>}
            <Btn title="Guardar" onPress={save} />
            {existing &&
              (confirmDelete ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: C.bad, textAlign: 'center' }}>¿Eliminar {existing.name}? Se borrarán sus recordatorios.</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Btn kind="soft" small title="Cancelar" onPress={() => setConfirmDelete(false)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn
                        kind="danger"
                        small
                        title="Eliminar"
                        onPress={() => {
                          deleteMed(existing.id);
                          router.back();
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Btn kind="danger" title="Eliminar medicamento" onPress={() => setConfirmDelete(true)} />
              ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 15, color: C.fg }}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityState={{ selected: on }} style={[st.chip, on && st.chipOn]} onPress={onPress}>
      <Text style={[st.chipText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/** Hora que se elige con el reloj de Android al tocarla. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const open = () => {
    const [h, m] = value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: true,
      onChange: (e, date) => {
        if (e.type === 'set' && date) onChange(hhmmOf(date));
      },
    });
  };
  return (
    <Pressable onPress={open} style={st.timeField} accessibilityRole="button" accessibilityLabel={`Hora ${fmtTime(value)}. Toca para cambiarla`}>
      <Icon name="clock" color={C.brand} size={22} />
      <Text style={st.time}>{fmtTime(value)}</Text>
      <Text style={{ color: C.brand, fontWeight: '700' }}>Cambiar</Text>
    </Pressable>
  );
}

/** Primeras tomas de un tratamiento "cada N horas", con el día abreviado. Ej.: "lun 08:00". */
function firstDoses(startDate: string, startTime: string, everyHours: number, n: number) {
  const first = doseDate(startDate, startTime);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(first);
    d.setMinutes(d.getMinutes() + k * everyHours * 60);
    return `${d.toLocaleDateString('es', { weekday: 'short' })} ${fmtTime(hhmmOf(d))}`;
  });
}

const st = StyleSheet.create({
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.fg, backgroundColor: C.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start' },
  chipOn: { backgroundColor: C.chip, borderColor: C.chip },
  chipText: { fontWeight: '700', color: C.muted, fontSize: 14 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: '#fff' },
  timeField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.line },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface2, borderRadius: 12, padding: 6, borderWidth: 1, borderColor: C.line },
  time: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.fg, fontVariant: ['tabular-nums'] },
  step: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: C.surface },
  summary: { backgroundColor: C.surface2, borderRadius: 12, padding: 12, gap: 4 },
  summaryTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' },
  summaryText: { fontSize: 16, fontWeight: '700', color: C.fg },
});
