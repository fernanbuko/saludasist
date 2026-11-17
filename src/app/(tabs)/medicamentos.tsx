import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, PillIcon } from '../../components/art';
import { Btn, Card, Header, ScreenTitle, s } from '../../components/ui';
import { doseTxt, freqTxt, isFinished, timesTxt } from '../../lib/dose';
import { useApp } from '../../lib/store';
import { C, shadow } from '../../theme';

export default function Medicamentos() {
  const { state } = useApp();
  const add = () => router.push('/medicamento');
  return (
    <View style={{ flex: 1 }}>
      <Header
        title="SaludAsist"
        right={
          <Pressable accessibilityLabel="Añadir medicamento" hitSlop={12} onPress={add}>
            <Icon name="plus" color="#fff" size={26} stroke={2.6} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={[s.screen, { paddingBottom: 100 }]}>
        <ScreenTitle>Medicamentos</ScreenTitle>
        {state.meds.length ? (
          <View style={st.grid}>
            {state.meds.map((m) => (
              <Pressable key={m.id} style={[st.card, isFinished(m) && { opacity: 0.55 }]} onPress={() => router.push({ pathname: '/medicamento', params: { id: m.id } })}>
                <PillIcon color={m.color} type={m.type} size={62} />
                <Text style={st.name} numberOfLines={2}>
                  {m.name}
                </Text>
                <Text style={st.meta}>Dosis: {doseTxt(m)}</Text>
                <Text style={st.meta}>{freqTxt(m)}</Text>
                <Text style={st.meta} numberOfLines={2}>
                  {timesTxt(m)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <Text style={[s.sub, { textAlign: 'center', fontSize: 15 }]}>Todavía no hay medicamentos. Añade el primero con su dosis y horario.</Text>
            <Btn title="Añadir medicamento" icon="plus" onPress={add} />
          </Card>
        )}
      </ScrollView>
      <Pressable accessibilityLabel="Añadir medicamento" onPress={add} style={st.fab}>
        <Icon name="plus" color="#fff" size={28} stroke={2.6} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, padding: 14, alignItems: 'center', gap: 3, ...shadow },
  name: { fontSize: 16, fontWeight: '800', color: C.fg, marginTop: 4, textAlign: 'center' },
  meta: { fontSize: 12.5, color: C.muted, textAlign: 'center' },
  fab: { position: 'absolute', right: 18, bottom: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', ...shadow, elevation: 6 },
});
