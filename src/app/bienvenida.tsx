import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Avatar, Shield } from '../components/art';
import { Btn } from '../components/ui';
import { SignInError, signInWithGoogle } from '../lib/authGoogle';
import { requestPermission } from '../lib/notifications';
import { useApp } from '../lib/store';
import { C, themed } from '../theme';

export default function Bienvenida() {
  const { status } = useApp();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Tras iniciar sesión, la pantalla inicial decide a dónde ir (crear perfil o entrar).
  useEffect(() => {
    if (status !== 'signedOut' && status !== 'loading') router.replace('/');
  }, [status]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await requestPermission().catch(() => false);
      await signInWithGoogle();
    } catch (e) {
      if (!(e instanceof SignInError && e.cancelled)) setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: C.surface }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[st.hero, { paddingTop: insets.top + 40 }]}>
        <Shield size={64} />
        <Text style={st.brand}>SaludAsist</Text>
      </View>
      <View style={st.body}>
        <View style={st.avatar}>
          <Avatar size={150} />
        </View>
        <Text style={st.hello}>¡Hola! Bienvenido a SaludAsist. Cuidamos tu salud.</Text>
        <View style={{ gap: 6, alignSelf: 'stretch' }}>
          <Text style={st.bullet}>• Te aviso a la hora de cada medicamento, aunque la app esté cerrada.</Text>
          <Text style={st.bullet}>• Confirmas la toma con una foto y la IA la verifica.</Text>
          <Text style={st.bullet}>• Tu familia ve las tomas desde su teléfono y recibe avisos si se olvida una dosis.</Text>
          <Text style={st.bullet}>• Tus datos quedan guardados en tu cuenta de Google: no se pierden al cambiar de teléfono.</Text>
        </View>
        {!!error && <Text style={st.error}>{error}</Text>}
        <View style={{ alignSelf: 'stretch' }}>
          <Btn kind="soft" title={busy ? 'Conectando…' : 'Continuar con Google'} loading={busy} onPress={start} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <GoogleG />
          <Text style={st.small}>Usamos tu cuenta de Google solo para guardar tus datos y compartirlos con tu familia.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

const st = themed(() => ({
  hero: { backgroundColor: C.header, alignItems: 'center', paddingBottom: 100, borderBottomLeftRadius: 200, borderBottomRightRadius: 200, gap: 6 },
  brand: { color: '#fff', fontSize: 36, fontWeight: '900' },
  body: { marginTop: -84, alignItems: 'center', gap: 18, paddingHorizontal: 24, paddingBottom: 40 },
  avatar: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', borderWidth: 5, borderColor: '#fff', backgroundColor: C.surface2 },
  hello: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: C.fg },
  bullet: { fontSize: 15, color: C.muted, lineHeight: 21 },
  small: { flex: 1, fontSize: 12.5, color: C.muted },
  error: { color: C.bad, textAlign: 'center', fontSize: 14 },
}));
