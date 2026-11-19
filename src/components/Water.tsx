import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../lib/store';
import { waterHours, type WaterSettings } from '../lib/water';
import { C } from '../theme';
import { Btn, Card, s } from './ui';

/** Contador de vasos de agua de hoy (pantalla Hoy, solo si el recordatorio está activado). */
export function WaterToday() {
  const { water, waterToday, addWater, role } = useApp();
  if (!water.on || role !== 'patient') return null;
  const done = waterToday >= water.goal;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg, flex: 1 }}>💧 Agua de hoy</Text>
        <Text style={{ fontSize: 17, fontWeight: '800', color: done ? C.ok : C.brand }}>
          {waterToday} de {water.goal} vasos
        </Text>
      </View>
      <View style={st.glasses} accessibilityLabel={`${waterToday} de ${water.goal} vasos`}>
        {Array.from({ length: water.goal }, (_, i) => (
          <View key={i} style={[st.glass, i < waterToday && st.glassOn]} />
        ))}
      </View>
      {done && <Text style={{ color: C.ok, fontWeight: '700' }}>¡Muy bien! Ya llegaste a tu meta de hoy.</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn small title="+1 vaso" onPress={() => addWater(1)} />
        </View>
        {waterToday > 0 && (
          <View style={{ width: 110 }}>
            <Btn kind="soft" small title="Quitar uno" onPress={() => addWater(-1)} />
          </View>
        )}
      </View>
    </Card>
  );
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Ajustes del recordatorio de agua. */
export function WaterSettingsCard() {
  const { water, setWater, role } = useApp();
  if (role !== 'patient') return null;
  const set = (patch: Partial<WaterSettings>) => setWater({ ...water, ...patch });

  const toggle = (v: boolean) => {
    if (!v) return set({ on: false });
    Alert.alert(
      'Recordatorio de agua',
      'Consulta con tu médico cuánta agua puedes tomar al día. Algunas enfermedades del corazón o del riñón necesitan limitar los líquidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Activar', onPress: () => set({ on: true }) },
      ],
    );
  };

  const hours = waterHours(water);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg }}>💧 Recordatorio de agua</Text>
          <Text style={s.sub}>Un aviso suave durante el día, sin sonido de alarma.</Text>
        </View>
        <Switch value={water.on} onValueChange={toggle} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
      </View>
      {water.on && (
        <>
          <Opt label="Cada cuánto" values={[1, 2, 3]} value={water.every} fmt={(v) => `${v} ${v === 1 ? 'hora' : 'horas'}`} onPick={(v) => set({ every: v })} />
          <Opt label="Desde" values={[7, 8, 9, 10]} value={water.from} fmt={hh} onPick={(v) => set({ from: v })} />
          <Opt label="Hasta" values={[18, 19, 20, 21]} value={water.to} fmt={hh} onPick={(v) => set({ to: v })} />
          <Opt label="Meta diaria" values={[6, 8, 10]} value={water.goal} fmt={(v) => `${v} vasos`} onPick={(v) => set({ goal: v })} />
          <Text style={s.sub}>Avisos a las: {hours.map(hh).join(', ')}.</Text>
        </>
      )}
    </Card>
  );
}

function Opt({ label, values, value, fmt, onPick }: { label: string; values: number[]; value: number; fmt: (v: number) => string; onPick: (v: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '700', color: C.fg }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {values.map((v) => (
          <Pressable key={v} onPress={() => onPick(v)} style={[st.chip, v === value && st.chipOn]} accessibilityState={{ selected: v === value }}>
            <Text style={[st.chipText, v === value && { color: '#fff' }]}>{fmt(v)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  glasses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  glass: { width: 26, height: 32, borderRadius: 6, borderWidth: 2, borderColor: C.brand, backgroundColor: C.surface },
  glassOn: { backgroundColor: '#5AA9E6', borderColor: '#3A8CC9' },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: C.chip, borderColor: C.chip },
  chipText: { fontWeight: '700', color: C.muted, fontSize: 14 },
});
