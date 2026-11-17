import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Icon } from '../components/art';
import { Btn } from '../components/ui';
import { dkey, fmtTime, instancesFor, statusOf } from '../lib/dose';
import { useApp } from '../lib/store';
import { C } from '../theme';

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
  if (h >= 12 && h < 20) return 'Buenas tardes';
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

  let resumen: string;
  if (!ins.length) resumen = family ? `${patient} no tiene tomas programadas hoy.` : 'Hoy no tienes tomas programadas.';
  else if (done === ins.length) resumen = family ? `${patient} ya tomó todo lo de hoy.` : '¡Ya tomaste todo lo de hoy!';
  else resumen = family ? `${patient} lleva ${done} de ${ins.length} tomas de hoy.` : `Hoy tienes ${ins.length} ${ins.length === 1 ? 'toma' : 'tomas'}. Llevas ${done}.`;

  const what = next?.med.type === 'liquid' ? 'medicina' : 'pastilla';
  const proxima = next ? `${family ? 'Su' : 'Tu'} próxima ${what}: ${next.med.name} a las ${fmtTime(next.time)}.` : '';
  const aviso = missed ? `${missed === 1 ? 'Hay 1 dosis' : `Hay ${missed} dosis`} sin registrar.` : '';
  const frase = FRASES[now.getDate() % FRASES.length];
  const titulo = `${greeting(now)}${myName ? `, ${myName}` : ''}`;

  const hablar = () => Speech.speak([`${titulo}.`, resumen, proxima, aviso].filter(Boolean).join(' '), { language: 'es-ES' });

  return (
    <View style={[st.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
      <View style={st.avatar}>
        <Avatar size={150} />
      </View>
      <Text style={st.hello}>{titulo}</Text>
      <Text style={st.date}>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</Text>

      <View style={st.card}>
        <Text style={st.summary}>{resumen}</Text>
        {!!proxima && <Text style={st.next}>{proxima}</Text>}
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

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.brand, alignItems: 'center', paddingHorizontal: 24, gap: 10 },
  avatar: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', borderWidth: 5, borderColor: '#fff', backgroundColor: C.surface2 },
  hello: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  date: { color: '#D7E7F7', fontSize: 17, textAlign: 'center' },
  card: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 18, gap: 8, marginTop: 14 },
  summary: { color: '#fff', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  next: { color: '#fff', fontSize: 17, textAlign: 'center' },
  warn: { color: '#FFE2B8', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  quote: { color: '#D7E7F7', fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  speak: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', marginBottom: 6 },
});
