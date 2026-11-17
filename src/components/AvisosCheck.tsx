import { useCallback, useEffect, useState } from 'react';
import { AppState as RNAppState, Linking, Platform, Share, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Alarm from '../../modules/saludasist-alarm';
import { requestPermission } from '../lib/notifications';
import { useApp } from '../lib/store';
import { C } from '../theme';
import { Btn, Card, s } from './ui';

/**
 * "Recordatorios y avisos": elegir alarma a pantalla completa o notificación,
 * ver qué permisos faltan (con acceso directo a cada ajuste) y lanzar una alarma de prueba.
 */
export function AvisosCheck() {
  const { role, alarmMode, setAlarmMode } = useApp();
  const [perm, setPerm] = useState({ notif: true, full: true, exact: true, count: 0 });
  const [msg, setMsg] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState('');

  const refresh = useCallback(async () => {
    const n = await Notifications.getPermissionsAsync().catch(() => null);
    setPerm({
      notif: !!n?.granted,
      full: Alarm ? Alarm.canUseFullScreenIntent() : true,
      exact: Alarm ? Alarm.canScheduleExactAlarms() : true,
      count: Alarm ? Alarm.scheduledCount() : 0,
    });
    setLog(Alarm ? Alarm.diagnostics() : '');
  }, []);

  // Al volver de los ajustes del teléfono, actualizar el estado de los permisos.
  useEffect(() => {
    refresh();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const isPatient = role === 'patient';
  // Solo algunos fabricantes tienen la pantalla de «Inicio automático»; en el resto no se muestra el botón.
  const hasAutostart = Platform.OS === 'android' && /xiaomi|redmi|poco/i.test(String((Platform.constants as { Manufacturer?: string; Brand?: string }).Manufacturer ?? '') + String((Platform.constants as { Brand?: string }).Brand ?? ''));
  const ok = perm.notif && (!isPatient || !alarmMode || (perm.full && perm.exact));

  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg }}>Recordatorios y avisos</Text>
      {isPatient && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: C.fg }}>Recordatorios tipo alarma</Text>
            <Text style={s.sub}>
              {alarmMode ? 'A pantalla completa, con sonido de alarma hasta que respondas.' : 'Como notificación normal.'}
            </Text>
          </View>
          <Switch value={alarmMode} onValueChange={setAlarmMode} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
        </View>
      )}

      <Text style={{ color: ok ? C.ok : C.warn, fontWeight: '700' }}>{ok ? '● Todo listo para recibir los avisos' : '● Falta algún permiso: revisa la lista'}</Text>
      <Check label="Notificaciones permitidas" ok={perm.notif} fix={() => requestPermission().then(refresh)} />
      {isPatient && alarmMode && (
        <>
          <Check label="Alarma a pantalla completa" ok={perm.full} fix={() => Alarm?.openFullScreenSettings()} />
          <Check label="Alarmas a la hora exacta" ok={perm.exact} fix={() => Alarm?.openExactAlarmSettings()} />
          <Text style={s.sub}>Alarmas programadas en este teléfono: {perm.count}</Text>
        </>
      )}

      <View style={{ gap: 8, backgroundColor: C.surface2, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: C.fg, fontWeight: '700' }}>Si los avisos no suenan con la app cerrada</Text>
        <Text style={[s.sub, { color: C.fg }]}>Algunos teléfonos detienen las apps para ahorrar batería. En los ajustes de la app revisa:</Text>
        <Text style={s.sub}>
          • Inicio automático (si tu teléfono lo tiene): activado{'\n'}• Batería: sin restricciones{'\n'}• Mostrar en pantalla de bloqueo: activado{'\n'}• Mostrar ventanas emergentes en segundo plano: activado
        </Text>
        {hasAutostart && <Btn small title="Inicio automático" onPress={() => Alarm?.openXiaomiAutostart()} />}
        {hasAutostart && <Btn kind="soft" small title="Batería de la app" onPress={() => Alarm?.openXiaomiBattery()} />}
        <Btn kind="soft" small title="Abrir ajustes de la app" onPress={() => Linking.openSettings()} />
      </View>

      {isPatient && alarmMode && Alarm && (
        <Btn
          small
          title="Probar la alarma (suena en 1 minuto)"
          onPress={() => {
            Alarm!.test(60);
            setMsg('Alarma de prueba programada. Bloquea el teléfono y espera 1 minuto.');
          }}
        />
      )}
      {!!msg && <Text style={{ color: C.ok }}>{msg}</Text>}
      {isPatient && Alarm && (
        <>
          <Btn kind="soft" small title={showLog ? 'Ocultar registro de la alarma' : 'Ver registro de la alarma'} onPress={() => (refresh(), setShowLog(!showLog))} />
          {showLog && (
            <>
              <Text selectable style={{ fontFamily: 'monospace', fontSize: 11, color: C.fg, backgroundColor: C.surface2, padding: 8, borderRadius: 8 }}>
                {log || 'Todavía no hay registros.'}
              </Text>
              <Btn kind="soft" small title="Compartir registro" onPress={() => Share.share({ message: `Registro de la alarma de SaludAsist:\n${log}` })} />
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Check({ label, ok, fix }: { label: string; ok: boolean; fix: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ flex: 1, color: C.fg }}>
        {ok ? '✅' : '⚠️'} {label}
      </Text>
      {!ok && (
        <View style={{ width: 110 }}>
          <Btn kind="soft" small title="Activar" onPress={fix} />
        </View>
      )}
    </View>
  );
}
