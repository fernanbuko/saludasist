import '../lib/crash-init';
import { useEffect, useState } from 'react';
import { Appearance, ScrollView, Share, Text, View } from 'react-native';
import Alarm from '../../modules/saludasist-alarm';
import type { ErrorBoundaryProps } from 'expo-router';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerBackground } from '../lib/background';
import { ACTION_SNOOZE, configureHandler, keyFromNotification, setupChannelsAndActions, snoozeNotification } from '../lib/notifications';
import { StoreProvider, useApp } from '../lib/store';
import { findInstance } from '../lib/dose';
import { ACTION_WATER } from '../lib/water';
import { C } from '../theme';
import { clearLastCrash, onJsError, readLastCrash } from '../lib/crash';
import { Btn } from '../components/ui';

try {
  configureHandler();
} catch {}

/** Pantalla que muestra el error que cerró la app, para poder enviárselo al desarrollador. */
function CrashScreen({ text, onContinue }: { text: string; onContinue?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 48 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.bad }}>La app tuvo un problema</Text>
        <Text style={{ fontSize: 15, color: C.fg }}>Haz una captura de pantalla de este mensaje o pulsa «Compartir error» y envíaselo a quien te instaló la app.</Text>
        <Text selectable style={{ fontFamily: 'monospace', fontSize: 11, color: C.fg, backgroundColor: C.surface, padding: 10, borderRadius: 8 }}>
          {text.slice(0, 6000)}
        </Text>
        <Btn title="Compartir error" onPress={() => Share.share({ message: `Error de SaludAsist:\n\n${text.slice(0, 6000)}` })} />
        {onContinue && <Btn kind="soft" title="Intentar continuar" onPress={onContinue} />}
      </ScrollView>
    </View>
  );
}

/** Expo Router muestra esto si una pantalla falla al dibujarse, en vez de cerrar la app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen text={`${error.name}: ${error.message}\n\n${error.stack ?? ''}`} onContinue={retry} />;
}

function NotificationRouter() {
  const { state, ready, update, role, addWater } = useApp();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    setupChannelsAndActions().catch(() => {});
    registerBackground();
  }, []);

  // Al tocar una notificación (o uno de sus botones) se abre la dosis correspondiente.
  useEffect(() => {
    if (!ready || !last) return;
    // Recordatorio de agua: el botón «Ya tomé un vaso» lo apunta en el contador de hoy.
    if ((last.notification.request.content.data as Record<string, unknown> | undefined)?.type === 'agua') {
      Notifications.clearLastNotificationResponse?.();
      if (last.actionIdentifier === ACTION_WATER) addWater(1);
      Notifications.dismissNotificationAsync(last.notification.request.identifier).catch(() => {});
      return;
    }
    const key = keyFromNotification(last.notification.request.content.data as Record<string, unknown>);
    Notifications.clearLastNotificationResponse?.();
    if (!key) return;
    const inst = findInstance(state, key);
    // En el teléfono del familiar los avisos solo abren la app; la toma la confirma quien la toma.
    if (!inst || state.log[key] || role === 'caregiver') {
      router.replace('/');
      return;
    }
    if (last.actionIdentifier === ACTION_SNOOZE) {
      snoozeNotification(key, inst.med.name, 10, inst.med).catch(() => {});
      update((s) => ({ ...s, snooze: { ...s.snooze, [key]: Date.now() + 10 * 60_000 } }));
      Notifications.dismissNotificationAsync(last.notification.request.identifier).catch(() => {});
      return;
    }
    router.push({ pathname: '/validar', params: { key } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, last]);

  return null;
}

export default function RootLayout() {
  const [crash, setCrash] = useState<string | null>(() => readLastCrash());
  useEffect(() => onJsError(setCrash), []);
  if (crash)
    return (
      <SafeAreaProvider>
        <CrashScreen
          text={crash}
          onContinue={() => {
            clearLastCrash();
            setCrash(null);
          }}
        />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <NotificationRouter />
        <ThemedStack />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

/**
 * Modo claro u oscuro: «Automático» sigue al teléfono; también se puede fijar en Ajustes.
 * La paleta la aplica el StoreProvider; aquí se ajustan los botones del sistema.
 */
function ThemedStack() {
  const { dark } = useApp();
  // Botones ◁ ○ □ del sistema: oscuros sobre la app clara y claros sobre la oscura (si no, no se ven).
  useEffect(() => {
    const apply = () => {
      try {
        Alarm?.setNavButtonsDark(!dark);
      } catch {}
    };
    apply();
    const t = setTimeout(apply, 600);
    const sub = Appearance.addChangeListener(() => setTimeout(apply, 100));
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [dark]);
  return <AppStack />;
}

/** Pantallas sin pestañas: dejan libre el espacio de la barra de navegación del sistema. */
function AppStack() {
  useApp(); // se vuelve a dibujar al cambiar el modo claro/oscuro
  const bottom = useSafeAreaInsets().bottom;
  const padded = { contentStyle: { backgroundColor: C.bg, paddingBottom: bottom } };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bienvenida" options={padded} />
      <Stack.Screen name="perfil" options={padded} />
      <Stack.Screen name="saludo" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="validar" options={padded} />
      <Stack.Screen name="medicamento" options={padded} />
      <Stack.Screen name="informe" options={padded} />
      <Stack.Screen name="datos-paciente" options={padded} />
    </Stack>
  );
}
