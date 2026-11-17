import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { Icon } from '../../components/art';
import { C } from '../../theme';

type IconName = React.ComponentProps<typeof Icon>['name'];
const icon = (name: IconName) => ({ color }: { color: unknown }) => <Icon name={name} color={typeof color === 'string' ? color : C.muted} size={24} />;

export default function TabsLayout() {
  const { status } = useApp();
  // Respetar la barra de navegación del sistema (botones o gestos) en todos los teléfonos.
  const bottom = useSafeAreaInsets().bottom;
  // Al cerrar sesión o perder el acceso, volver a la pantalla inicial.
  if (status === 'signedOut' || status === 'needsProfile') return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 64 + bottom, paddingTop: 6, paddingBottom: bottom + 6 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icon('today') }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIcon: icon('history') }} />
      <Tabs.Screen name="medicamentos" options={{ title: 'Medicinas', tabBarIcon: icon('meds') }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: icon('settings') }} />
      <Tabs.Screen name="asistente" options={{ title: 'Asistente', tabBarIcon: icon('assistant') }} />
    </Tabs>
  );
}
