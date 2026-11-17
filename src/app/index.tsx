import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../lib/store';
import { C } from '../theme';

/** Decide la primera pantalla según el estado de la cuenta. */
export default function Index() {
  const { status } = useApp();
  if (status === 'signedOut') return <Redirect href="/bienvenida" />;
  if (status === 'needsProfile') return <Redirect href="/perfil" />;
  if (status === 'ready') return <Redirect href="/(tabs)" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, gap: 12 }}>
      <ActivityIndicator color={C.brand} size="large" />
      <Text style={{ color: C.muted }}>Cargando tus datos…</Text>
    </View>
  );
}
