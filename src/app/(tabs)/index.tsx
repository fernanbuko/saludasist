import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { Icon } from '../../components/art';
import { Btn, Card, DoseRow, Header, ScreenTitle, Speak, s } from '../../components/ui';
import { doseTxt, dkey, fmtTime, focusDose, instancesFor, statusOf, treatmentDay, unitTxt } from '../../lib/dose';
import { snoozeNotification } from '../../lib/notifications';
import { useApp } from '../../lib/store';
import { openUpdate, useUpdate } from '../../lib/updates';
import { StockAlerts } from '../../components/StockAlerts';
import { C } from '../../theme';

export default function Hoy() {
  const { state, update, tick, role, ready } = useApp();
  const newVersion = useUpdate(ready);
  const family = role === 'caregiver'; // teléfono del familiar que acompaña
  void tick; // re-render periódico para que los estados sigan la hora
  const today = dkey(new Date());
  const ins = instancesFor(state, today);
  const f = focusDose(state);
  const name = state.settings.patientName.trim();

  let main: React.ReactNode;
  if (!state.meds.length) {
    main = (
      <Card>
        <Speak>{family ? `${name || 'Tu familiar'} aún no tiene medicamentos. Puedes añadirlos tú y se le recordarán en su teléfono.` : `¡Hola${name ? `, ${name}` : ''}! Aún no hay medicamentos. Añade el primero y te recordaré cada toma.`}</Speak>
        <Btn title="Añadir medicamento" icon="plus" onPress={() => router.push('/medicamento')} />
      </Card>
    );
  } else if (!f) {
    main = (
      <Card>
        <Speak>{family ? `${name || 'Tu familiar'} ya registró todas las dosis de hoy.` : `¡Muy bien${name ? `, ${name}` : ''}! Ya registraste todas las dosis de hoy. Nos vemos mañana.`}</Speak>
      </Card>
    );
  } else {
    const st = statusOf(state, f);
    const m = f.med;
    const what = m.type === 'liquid' ? 'medicina' : 'pastilla';
    const who = name || 'Tu familiar';
    const say = family
      ? st === 'due'
        ? `${who} tiene pendiente su ${what} de las ${fmtTime(f.time)}.`
        : st === 'missed'
          ? `${who} no ha registrado la dosis de las ${fmtTime(f.time)}. Quizá quieras llamarle.`
          : `La próxima ${what} de ${who} (${m.name}) es a las ${fmtTime(f.time)}.`
      :
      st === 'due'
        ? `¡Hola${name ? `, ${name}` : ''}! Es hora de tu ${what}. ¿Ya la tomaste?`
        : st === 'missed'
          ? `La dosis de las ${fmtTime(f.time)} quedó sin registrar. ¿La tomaste?`
          : `Tu próxima ${what} (${m.name}) es a las ${fmtTime(f.time)}. Te avisaré cuando sea la hora.`;
    const snooze = () => {
      snoozeNotification(f.key, m.name, 10, m).catch(() => {});
      update((x) => ({ ...x, snooze: { ...x.snooze, [f.key]: Date.now() + 10 * 60_000 } }));
    };
    main = (
      <>
        <ScreenTitle>Recordatorio de medicamento</ScreenTitle>
        <Card>
          <Speak
            extra={
              <Pressable
                accessibilityLabel="Escuchar el recordatorio"
                onPress={() => Speech.speak(`${say} ${m.name}, ${doseTxt(m)}.`, { language: 'es-ES' })}
                style={{ position: 'absolute', left: 50, bottom: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: C.brand, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="speaker" color="#fff" size={15} />
              </Pressable>
            }
          >
            {say}
          </Speak>
          <View style={s.facts}>
            <Text style={s.fact}>
              <Text style={s.factLabel}>{m.type === 'liquid' ? 'MEDICINA: ' : 'PASTILLA: '}</Text>
              {m.name}
            </Text>
            <Text style={s.fact}>
              <Text style={s.factLabel}>DOSIS: </Text>
              {doseTxt(m)} ({m.qty} {unitTxt(m)})
            </Text>
            <Text style={s.fact}>
              <Text style={s.factLabel}>HORA: </Text>
              {fmtTime(f.time)}
            </Text>
            {(() => {
              const td = treatmentDay(m, f.date, f.time);
              return td ? (
                <Text style={s.fact}>
                  <Text style={s.factLabel}>TRATAMIENTO: </Text>
                  {td.of ? `día ${td.day} de ${td.of}${td.day === td.of ? ' (último día)' : ''}` : 'de por vida'}
                </Text>
              ) : null;
            })()}
            {!!m.note && (
              <Text style={s.fact}>
                <Text style={s.factLabel}>NOTA: </Text>
                {m.note}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[s.fact, s.factLabel]}>ESTATUS:</Text>
              <Text style={{ color: st === 'missed' ? C.bad : st === 'upcoming' ? C.muted : C.warn, fontWeight: '800' }}>
                {st === 'due' ? '● PENDIENTE' : st === 'missed' ? '● SIN REGISTRAR' : '● PROGRAMADA'}
              </Text>
            </View>
          </View>
          {st === 'upcoming' ? (
            <Btn kind="soft" title={family ? "La tomó antes de la hora" : "La tomé antes de la hora"} onPress={() => router.push({ pathname: '/validar', params: { key: f.key } })} />
          ) : (
            <View style={{ gap: 10 }}>
              <Btn kind="ok" icon="check" title={family ? "Ya la tomó" : "Ya la tomé"} onPress={() => router.push({ pathname: '/validar', params: { key: f.key } })} />
              {(state.snooze[f.key] ?? 0) > Date.now() ? (
                <Text style={[s.sub, { textAlign: 'center' }]}>Te lo recuerdo de nuevo en unos minutos.</Text>
              ) : (
                <Btn title="Aún no" onPress={snooze} />
              )}
            </View>
          )}
        </Card>
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title="SaludAsist" />
      <ScrollView contentContainerStyle={s.screen}>
        <StockAlerts />
        {newVersion && (
          <Card style={{ backgroundColor: C.okSoft, gap: 8 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: C.fg }}>Hay una actualización: versión {newVersion.versionName}</Text>
            {!!newVersion.notes && <Text style={{ color: C.fg }}>{newVersion.notes}</Text>}
            <Btn kind="ok" small title="Actualizar" onPress={() => openUpdate(newVersion)} />
            <Text style={s.sub}>Se descarga el instalador. Al terminar, ábrelo y pulsa «Actualizar». Tus datos se conservan.</Text>
          </Card>
        )}
        {main}
        {ins.length > 0 && (
          <>
            <Text style={s.label}>Dosis de hoy</Text>
            <View style={{ gap: 10 }}>
              {ins.map((i) => (
                <DoseRow key={i.key} inst={i} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
