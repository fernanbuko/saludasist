import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { speak } from '../lib/voice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Icon } from '../components/art';
import { Btn } from '../components/ui';
import { dkey, fmtTime, instancesFor, statusOf } from '../lib/dose';
import { useApp } from '../lib/store';
import { C, themed } from '../theme';

const FRASES = [
  'Cuidarte también es tomar tus medicinas a tiempo.',
  'Un día a la vez. ¡Vas muy bien!',
  'Tu salud es lo primero.',
  'Gracias por cuidarte hoy.',
  'Pequeños hábitos, grandes resultados.',
  'Recuerda beber agua durante el día.',
];

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Pantalla de bienvenida al abrir la app: saludo, fecha y resumen de las tomas de hoy. Se queda hasta pulsar «Continuar». */
export default function Saludo() {
  const { state, role, account, ready } = useApp();
  const insets = useSafeAreaInsets();
  const left = useRef(false);

  const go = () => {
    if (left.current) return;
    left.current = true;
    Speech.stop();
    router.replace('/(tabs)');
  };

  useEffect(() => {
    if (!ready) {
      router.replace('/');
      return;
    }
    // El saludo se queda hasta que se pulsa «Continuar».
  }, [ready]);

  const family = role === 'caregiver';
  const patient = state.settings.patientName || 'tu familiar';
  const myName = (family ? account?.name : state.settings.patientName || account?.name)?.split(' ')[0] ?? '';
  const now = new Date();
  const fecha = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  const ins = instancesFor(state, dkey(now));
  const sts = ins.map((i) => statusOf(state, i));
  const done = sts.filter((x) => x === 'taken' || x === 'proof').length;
  const missed = sts.filter((x) => x === 'missed').length;
  const next = ins.find((i, n) => sts[n] === 'due' || sts[n] === 'upcoming');

  // Palabra según el tipo de medicamento: pastillas, tomas (líquidos) o dosis (si hay de los dos).
  const types = new Set(ins.map((i) => i.med.type));
  const [one, many] = types.size > 1 ? ['dosis', 'dosis'] : types.has('liquid') ? ['toma', 'tomas'] : ['pastilla', 'pastillas'];
  const n = ins.length;
  const pending = sts.filter((x) => x === 'due' || x === 'upcoming').length;
  const cuantas = `${n} ${n === 1 ? one : many}`;
  let resumen: string;
  if (!n) resumen = family ? `${patient} no tiene tomas programadas hoy.` : 'Hoy no tienes tomas programadas.';
  else if (done === n) resumen = family ? `${patient} ya tomó todo lo de hoy.` : '¡Ya tomaste todo lo de hoy!';
  else if (family)
    resumen = `Hoy a ${patient} le ${n === 1 ? 'toca' : 'tocan'} ${cuantas}.${done ? ` Ya tomó ${done}${pending ? `, le ${pending === 1 ? 'falta' : 'faltan'} ${pending}` : ''}.` : ''}`;
  else resumen = `Hoy te ${n === 1 ? 'toca' : 'tocan'} ${cuantas}.${done ? ` Ya tomaste ${done}${pending ? `, te ${pending === 1 ? 'falta' : 'faltan'} ${pending}` : ''}.` : ''}`;

  // Lista corta de lo de hoy: con muchas tomas, las próximas 4 (desde la primera pendiente).
  const MAX = 4;
  const firstOpen = Math.max(0, sts.findIndex((x) => x === 'due' || x === 'upcoming' || x === 'missed'));
  const from = n <= MAX ? 0 : Math.min(firstOpen, n - MAX);
  const lista = ins.slice(from, from + MAX).map((i, k) => ({ i, st: sts[from + k] }));
  const resto = n - from - lista.length;
  const ICON: Record<string, string> = { taken: '✅', proof: '✅', skipped: '⏭️', missed: '⚠️', due: '🔔', upcoming: '⏰' };

  const what = next?.med.type === 'liquid' ? 'medicina' : 'pastilla';
  const proxima = next ? `${family ? 'Su' : 'Tu'} próxima ${what}: ${next.med.name} a las ${fmtTime(next.time)}.` : '';
  const aviso = missed ? `${missed === 1 ? 'Hay 1 dosis' : `Hay ${missed} dosis`} sin registrar.` : '';
  const frase = FRASES[now.getDate() % FRASES.length];
  const titulo = `${greeting(now)}${myName ? `, ${myName}` : ''}`;

  const hablar = () => speak([`${titulo}.`, resumen, proxima, aviso].filter(Boolean).join(' '));

  return (
    <View style={[st.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
      <View style={st.avatar}>
        <Avatar size={150} />
      </View>
      <Text style={st.hello}>{titulo}</Text>
      <Text style={st.date}>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</Text>

      <View style={st.card}>
        <Text style={st.summary}>{resumen}</Text>
        {lista.length > 0 && (
          <View style={st.list}>
            {lista.map(({ i, st: s }) => {
              const doneRow = s === 'taken' || s === 'proof' || s === 'skipped';
              return (
                <View key={i.key} style={st.row}>
                  <Text style={st.rowIcon}>{ICON[s] ?? '⏰'}</Text>
                  <Text style={[st.rowTime, doneRow && st.rowDone]}>{fmtTime(i.time)}</Text>
                  <Text style={[st.rowName, doneRow && st.rowDone]} numberOfLines={1}>
                    {i.med.name}
                  </Text>
                </View>
              );
            })}
            {resto > 0 && <Text style={st.more}>y {resto} más</Text>}
          </View>
        )}
        {!!aviso && <Text style={st.warn}>{aviso}</Text>}
      </View>

      <Text style={st.quote}>{frase}</Text>

      <View style={{ flex: 1 }} />
      <Pressable onPress={hablar} style={st.speak} accessibilityLabel="Escuchar el saludo">
        <Icon name="speaker" color="#fff" size={22} />
        <Text style={{ color: '#fff', fontWeight: '700' }}>Escuchar</Text>
      </Pressable>
      <View style={{ alignSelf: 'stretch' }}>
        <Btn kind="soft" title="Continuar" onPress={go} />
      </View>
    </View>
  );
}

const st = themed(() => ({
  root: { flex: 1, backgroundColor: C.header, alignItems: 'center', paddingHorizontal: 24, gap: 10 },
  avatar: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', borderWidth: 5, borderColor: '#fff', backgroundColor: C.surface2 },
  hello: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  date: { color: '#D7E7F7', fontSize: 17, textAlign: 'center' },
  card: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 18, gap: 8, marginTop: 14 },
  summary: { color: '#fff', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  list: { gap: 6, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowTime: { color: '#fff', fontSize: 18, fontWeight: '800', width: 58 },
  rowName: { color: '#fff', fontSize: 18, flex: 1 },
  rowDone: { opacity: 0.6 },
  more: { color: '#D7E7F7', fontSize: 15, textAlign: 'center' },
  warn: { color: '#FFE2B8', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  quote: { color: '#D7E7F7', fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  speak: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', marginBottom: 6 },
}));
