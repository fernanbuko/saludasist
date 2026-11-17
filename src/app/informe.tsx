import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Btn, Card, Header, ScreenTitle, s } from '../components/ui';
import { fmtTime } from '../lib/dose';
import { buildReport, reportHtml, reportText } from '../lib/report';
import { useApp } from '../lib/store';
import { C } from '../theme';

const PERIODS = [7, 14, 30];

/** Informe para el médico: resumen del periodo y opciones para compartirlo como texto o PDF. */
export default function Informe() {
  const { state } = useApp();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const r = useMemo(() => buildReport(state, days), [state, days]);

  const sharePdf = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { uri } = await Print.printToFileAsync({ html: reportHtml(r) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir informe' });
    } catch {
      setMsg('No se pudo crear el PDF. Puedes compartirlo como texto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Informe" back />
      <ScrollView contentContainerStyle={s.screen}>
        <ScreenTitle>Informe para el médico</ScreenTitle>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {PERIODS.map((p) => (
            <View key={p} style={{ flex: 1 }}>
              <Btn small kind={p === days ? 'primary' : 'soft'} title={`${p} días`} onPress={() => setDays(p)} />
            </View>
          ))}
        </View>

        <Card>
          <Text style={st.h}>{r.patient}</Text>
          <Text style={s.sub}>
            Del {new Date(r.from + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })} al{' '}
            {new Date(r.to + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })}
          </Text>
          <View style={st.kpis}>
            <Kpi value={r.adherence == null ? '—' : `${r.adherence}%`} label="Cumplimiento" />
            <Kpi value={`${r.taken}/${r.scheduled}`} label="Tomas" />
            <Kpi value={String(r.verified)} label="Con foto" />
          </View>
          <View style={st.kpis}>
            <Kpi value={String(r.missed)} label="Olvidadas" warn={r.missed > 0} />
            <Kpi value={String(r.skipped)} label="Omitidas" warn={r.skipped > 0} />
          </View>
        </Card>

        <Card>
          <Text style={st.h}>Medicamentos</Text>
          {r.meds.length ? (
            r.meds.map((m) => (
              <View key={m.med.id} style={st.row}>
                <Text style={{ flex: 1, color: C.fg, fontWeight: '700' }}>{m.med.name}</Text>
                <Text style={{ color: C.fg }}>
                  {m.taken}/{m.scheduled} · {m.scheduled ? Math.round((m.taken * 100) / m.scheduled) : 0}%
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.sub}>Todavía no hay tomas en este periodo.</Text>
          )}
        </Card>

        {r.incidents.length > 0 && (
          <Card>
            <Text style={st.h}>Tomas no realizadas</Text>
            {r.incidents.slice(0, 10).map((i, n) => (
              <Text key={n} style={{ color: C.fg }}>
                {new Date(i.date + 'T00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} {fmtTime(i.time)} · {i.med} ·{' '}
                <Text style={{ color: i.status === 'missed' ? C.bad : C.warn, fontWeight: '700' }}>{i.status === 'missed' ? 'olvidada' : 'omitida'}</Text>
              </Text>
            ))}
            {r.incidents.length > 10 && <Text style={s.sub}>… y {r.incidents.length - 10} más en el informe completo.</Text>}
          </Card>
        )}

        <Btn icon="send" title={busy ? 'Creando PDF…' : 'Compartir PDF'} loading={busy} onPress={sharePdf} />
        <Btn kind="soft" title="Compartir como texto" onPress={() => Share.share({ message: reportText(r) })} />
        {!!msg && <Text style={{ color: C.bad, textAlign: 'center' }}>{msg}</Text>}
        <Text style={[s.sub, { textAlign: 'center' }]}>Puedes enviarlo por WhatsApp o correo, o enseñarlo en la consulta.</Text>
      </ScrollView>
    </View>
  );
}

function Kpi({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <View style={st.kpi}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: warn ? C.bad : C.fg }}>{value}</Text>
      <Text style={s.sub}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '800', color: C.fg },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
});
