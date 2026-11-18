import { useCallback, useEffect, useState } from 'react';
import { AppState as RNAppState, Linking, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Alarm from '../../modules/saludasist-alarm';
import { fmtTime } from '../lib/dose';
import { useApp } from '../lib/store';
import { C } from '../theme';
import { Btn, Card, s } from './ui';

interface Missed {
  id: string;
  title: string;
  at: number;
  reason: string;
}

const AUTOSTART_DONE = 'saludasist.autostartDone';

const when = (ms: number) => {
  const d = new Date(ms);
  const hm = fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  return `${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} a las ${hm}`;
};

/**
 * En la pantalla Hoy (teléfono de quien toma la medicación):
 *  - avisa si alguna alarma no llegó a sonar porque el teléfono cerró la app;
 *  - guía los pasos para que el teléfono no cierre SaludAsist (batería e «Inicio automático»).
 */
export function AlarmHealth() {
  const { role, tick } = useApp();
  const [missed, setMissed] = useState<Missed[]>([]);
  const [battery, setBattery] = useState(true);
  const [autostartDone, setAutostartDone] = useState(true);
  const [later, setLater] = useState(false);

  const read = useCallback(() => {
    if (!Alarm) return;
    try {
      const list = JSON.parse(Alarm.missedAlarms()) as Missed[];
      setMissed(Array.isArray(list) ? list.filter((m) => m.id !== 'prueba') : []);
    } catch {
      setMissed([]);
    }
    try {
      setBattery(Alarm.isIgnoringBatteryOptimizations());
    } catch {}
    if (Alarm.hasAutostart()) AsyncStorage.getItem(AUTOSTART_DONE).then((v) => setAutostartDone(v === '1')).catch(() => {});
  }, []);

  useEffect(() => {
    read();
    // Las alarmas que no sonaron se detectan al reprogramar, un momento después de abrir la app.
    const t = setTimeout(read, 2500);
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && setTimeout(read, 2500));
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [read]);
  useEffect(() => {
    if (tick) read();
  }, [tick, read]);

  if (!Alarm || role !== 'patient') return null;

  const off = missed.length > 0 && missed.every((m) => m.reason.includes('apagado'));
  return (
    <>
      {missed.length > 0 && (
        <Card style={{ backgroundColor: C.badSoft, gap: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.bad }}>
            {missed.length === 1 ? 'Una alarma no sonó' : `${missed.length} alarmas no sonaron`}
          </Text>
          {missed.slice(-3).map((m) => (
            <Text key={m.id + m.at} style={{ color: C.fg }}>
              • {m.title}: {when(m.at)}
            </Text>
          ))}
          <Text style={{ color: C.fg }}>
            {off
              ? 'El teléfono estaba apagado a esa hora.'
              : 'El teléfono cerró SaludAsist y borró la alarma. Revisa la configuración para que no vuelva a pasar.'}
          </Text>
          {!off && <Btn small title="Revisar configuración" onPress={() => router.navigate('/ajustes')} />}
          <Btn
            kind="soft"
            small
            title="Entendido"
            onPress={() => {
              Alarm!.clearMissed();
              read();
            }}
          />
        </Card>
      )}

      {!later && !battery && (
        <Card style={{ backgroundColor: C.surface2, gap: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.fg }}>Para que las alarmas suenen siempre</Text>
          <Text style={{ color: C.fg }}>
            Permite que SaludAsist funcione en segundo plano. Se abrirá una ventana del teléfono: pulsa «Permitir».
          </Text>
          <Btn small title="Permitir" onPress={() => Alarm!.requestIgnoreBatteryOptimizations()} />
          <Btn kind="soft" small title="Ahora no" onPress={() => setLater(true)} />
        </Card>
      )}

      {!later && battery && !autostartDone && (
        <Card style={{ backgroundColor: C.surface2, gap: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.fg }}>Último paso para las alarmas</Text>
          <Text style={{ color: C.fg }}>
            En este teléfono hay que activar SaludAsist en «Inicio automático». Si no, el teléfono puede cerrar la app y las alarmas no sonarán.
          </Text>
          <Btn small title="Abrir «Inicio automático»" onPress={() => Alarm!.openAutostart() || Linking.openSettings()} />
          <Btn
            kind="soft"
            small
            title="Ya lo activé"
            onPress={() => {
              AsyncStorage.setItem(AUTOSTART_DONE, '1').catch(() => {});
              setAutostartDone(true);
            }}
          />
        </Card>
      )}
    </>
  );
}
