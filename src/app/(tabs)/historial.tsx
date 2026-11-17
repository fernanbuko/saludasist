import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/art';
import { router } from 'expo-router';
import { Btn, Card, DoseRow, Header, s } from '../../components/ui';
import { adherence, dayScore, dkey, instancesFor, parseKey, streak } from '../../lib/dose';
import { useApp } from '../../lib/store';
import { C, shadow } from '../../theme';

export default function Historial() {
  const { state, tick } = useApp();
  void tick;
  const today = new Date();
  const tk = dkey(today);
  const [month, setMonth] = useState<[number, number]>([today.getFullYear(), today.getMonth()]);
  const [sel, setSel] = useState(tk);

  const [y, mo] = month;
  const first = new Date(y, mo, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells: { k: string; d: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== mo) break;
    cells.push({ k: dkey(d), d });
  }
  const mn = first.toLocaleDateString('es', { month: 'long' });
  const monthName = `${mn[0].toUpperCase()}${mn.slice(1)} ${y}`;
  const move = (delta: number) => {
    let m = mo + delta;
    let yy = y;
    if (m < 0) [m, yy] = [11, y - 1];
    if (m > 11) [m, yy] = [0, y + 1];
    setMonth([yy, m]);
  };
  const a7 = adherence(state, 7);
  const a30 = adherence(state, 30);
  const ins = instancesFor(state, sel);
  const selName = parseKey(sel).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ flex: 1 }}>
      <Header title="Historial" />
      <ScrollView contentContainerStyle={s.screen}>
        <Btn icon="send" title="Informe para el médico" onPress={() => router.push('/informe')} />
        <View style={st.stats}>
          <Stat value={a7 == null ? '—' : `${a7}%`} label="7 días" />
          <Stat value={a30 == null ? '—' : `${a30}%`} label="30 días" />
          <Stat value={String(streak(state))} label="días seguidos" />
        </View>
        <Card style={{ gap: 8 }}>
          <View style={st.calHead}>
            <Pressable accessibilityLabel="Mes anterior" hitSlop={10} onPress={() => move(-1)}>
              <Icon name="back" color={C.fg} />
            </Pressable>
            <Text style={st.month}>{monthName}</Text>
            <Pressable accessibilityLabel="Mes siguiente" hitSlop={10} onPress={() => move(1)} style={{ transform: [{ scaleX: -1 }] }}>
              <Icon name="back" color={C.fg} />
            </Pressable>
          </View>
          <View style={st.grid}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
              <Text key={d} style={[st.cell, st.dow]}>
                {d}
              </Text>
            ))}
            {cells.map(({ k, d }) => {
              const out = d.getMonth() !== mo;
              const sc = !out && k < tk && (!state.createdAt || k >= state.createdAt) ? dayScore(state, k) : null;
              let bg = 'transparent';
              let fg: string = out ? C.line : C.fg;
              if (sc) {
                if (sc.bad === 0 && sc.ok === sc.total) [bg, fg] = [C.ok, '#fff'];
                else if (sc.bad >= sc.ok) [bg, fg] = [C.bad, '#fff'];
                else [bg, fg] = [C.okSoft, C.fg];
              }
              return (
                <Pressable key={k} style={st.cell} onPress={() => setSel(k)} accessibilityLabel={d.toLocaleDateString('es', { day: 'numeric', month: 'long' })}>
                  <View style={[st.day, { backgroundColor: bg }, k === sel && st.sel, k === tk && st.today]}>
                    <Text style={{ color: fg, fontWeight: '600', fontSize: 14 }}>{d.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Legend c={C.ok} t="Todo tomado" />
            <Legend c={C.okSoft} t="Alguna olvidada" />
            <Legend c={C.bad} t="Mayoría olvidada" />
          </View>
        </Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.fg }}>Toma de dosis · {selName}</Text>
        {ins.length ? (
          <View style={{ gap: 10 }}>
            {ins.map((i) => (
              <DoseRow key={i.key} inst={i} />
            ))}
          </View>
        ) : (
          <Card>
            <Text style={[s.sub, { textAlign: 'center' }]}>No hay dosis programadas este día.</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View style={st.stat}>
    <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg }}>{value}</Text>
    <Text style={s.sub}>{label}</Text>
  </View>
);
const Legend = ({ c, t }: { c: string; t: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
    <Text style={s.sub}>{t}</Text>
  </View>
);

const st = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 10, alignItems: 'center', ...shadow },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  month: { fontSize: 17, fontWeight: '800', color: C.fg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dow: { fontWeight: '800', color: C.fg, textAlign: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sel: { borderWidth: 2, borderColor: C.brandDeep },
  today: { borderWidth: 2, borderColor: C.brand, borderStyle: 'dashed' },
});
