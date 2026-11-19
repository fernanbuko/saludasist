import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { missingProfile } from '../lib/dose';
import { useApp } from '../lib/store';
import { C } from '../theme';

/** Decide la primera pantalla según el estado de la cuenta. */
export default function Index() {
  const { status, role, profile } = useApp();
  if (status === 'signedOut') return <Redirect href="/bienvenida" />;
  if (status === 'needsProfile') return <Redirect href="/perfil" />;
  // Al abrir la app, primero el saludo; después pasa sola a "Hoy".
  // Quien lleva la medicación completa una vez los datos obligatorios del paciente (también al actualizar desde versiones anteriores).
  if (status === 'ready' && role === 'patient' && missingProfile(profile).length) return <Redirect href={{ pathname: '/datos-paciente', params: { primera: '1' } }} />;
  if (status === 'ready') return <Redirect href="/saludo" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, gap: 12 }}>
      <ActivityIndicator color={C.brand} size="large" />
      <Text style={{ color: C.muted }}>Cargando tus datos…</Text>
    </View>
  );
}
