import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Header, ScreenTitle, s } from '../components/ui';
import { JoinError } from '../lib/cloud';
import { useApp } from '../lib/store';
import { C, themed } from '../theme';

/** Primera vez con la cuenta: ¿esta persona toma la medicación o es un familiar con código? */
export default function Perfil() {
  const { account, status, removed, createPatient, joinWithCode, signOut } = useApp();
  const [mode, setMode] = useState<'choose' | 'patient' | 'family'>('choose');
  const [name, setName] = useState(account?.name?.split(' ')[0] ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const created = useRef(false);

  useEffect(() => {
    // Tras crear su propia medicación, se piden los datos del paciente (se pueden dejar para más tarde).
    if (status === 'ready') router.replace(created.current ? { pathname: '/datos-paciente', params: { primera: '1' } } : '/saludo');
    if (status === 'signedOut') router.replace('/bienvenida');
  }, [status]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof JoinError ? e.message : 'No se pudo completar. Revisa tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="SaludAsist" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
          <ScreenTitle>¿Quién eres?</ScreenTitle>
          <Text style={[s.sub, { textAlign: 'center', fontSize: 15 }]}>Has entrado como {account?.email}.</Text>
          {removed && (
            <Card style={{ backgroundColor: C.warnSoft }}>
              <Text style={{ color: C.fg }}>Ya no tienes acceso a la medicación que seguías. Pide un código nuevo a tu familiar o crea tu propio perfil.</Text>
            </Card>
          )}

          {(mode === 'choose' || mode === 'patient') && (
            <Card>
              <Text style={st.h}>Yo tomo la medicación</Text>
              <Text style={s.sub}>Recibirás los recordatorios en este teléfono y podrás compartir tu medicación con tu familia.</Text>
              {mode === 'patient' ? (
                <>
                  <Text style={st.label}>¿Cómo te llamas?</Text>
                  <TextInput placeholderTextColor={C.muted} style={st.input} value={name} onChangeText={setName} placeholder="Ej. Carmen" autoCapitalize="words" />
                  <Btn title={busy ? 'Creando…' : 'Empezar'} loading={busy} onPress={() => {
                      created.current = true;
                      run(() => createPatient(name));
                    }} />
                  <Btn kind="soft" small title="Volver" onPress={() => setMode('choose')} />
                </>
              ) : (
                <Btn title="Soy yo" onPress={() => setMode('patient')} />
              )}
            </Card>
          )}

          {(mode === 'choose' || mode === 'family') && (
            <Card>
              <Text style={st.h}>Soy familiar y tengo un código</Text>
              <Text style={s.sub}>Para acompañar la medicación de otra persona. Pídele el código en SaludAsist → Ajustes → «Compartir con un familiar».</Text>
              {mode === 'family' ? (
                <>
                  <TextInput placeholderTextColor={C.muted}
                    style={[st.input, st.code]}
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    accessibilityLabel="Código de invitación"
                  />
                  <Btn title={busy ? 'Uniéndome…' : 'Unirme'} loading={busy} disabled={code.length !== 6} onPress={() => run(() => joinWithCode(code))} />
                  <Btn kind="soft" small title="Volver" onPress={() => setMode('choose')} />
                </>
              ) : (
                <Btn kind="soft" title="Tengo un código" onPress={() => setMode('family')} />
              )}
            </Card>
          )}

          {!!error && <Text style={{ color: C.bad, textAlign: 'center' }}>{error}</Text>}
          <Btn kind="soft" small title="Usar otra cuenta de Google" onPress={() => signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = themed(() => ({
  h: { fontSize: 18, fontWeight: '800', color: C.fg },
  label: { fontWeight: '700', fontSize: 15, color: C.fg },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.fg, backgroundColor: C.surface2 },
  code: { fontSize: 26, fontWeight: '900', letterSpacing: 6, textAlign: 'center', fontFamily: 'monospace' },
}));
