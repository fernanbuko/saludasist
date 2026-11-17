import { useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AvisosCheck } from '../../components/AvisosCheck';
import { Btn, Card, Header, s } from '../../components/ui';
import { INVITE_HOURS } from '../../lib/cloud';
import { router } from 'expo-router';
import { ageFrom, fmtDateShort, SEX_TXT } from '../../lib/dose';
import { useApp } from '../../lib/store';
import { checkForUpdate, installedVersionName, openUpdate, type UpdateInfo } from '../../lib/updates';
import { C } from '../../theme';

export default function Ajustes() {
  const { state, account, role, members, ownerUid, profile, setPatientName, setVoice, createInvite, removeMember, leave, signOut } = useApp();
  const set = state.settings;
  const [name, setName] = useState(set.patientName);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); // uid a quitar, 'leave' o 'signout'
  const [upd, setUpd] = useState<UpdateInfo | null | 'none'>(null);

  const isOwner = role === 'patient';
  const family = Object.entries(members).filter(([uid]) => uid !== ownerUid);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setMsg('');
    try {
      await fn();
    } catch {
      setMsg('No se pudo completar. Revisa tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const shareCode = (c: string) =>
    Share.share({
      message: `Te invito a acompañar mi medicación en SaludAsist.\n1. Instala SaludAsist y entra con tu cuenta de Google.\n2. Elige «Soy familiar y tengo un código».\n3. Escribe este código: ${c}\n(Vale durante ${INVITE_HOURS} horas.)`,
    });

  return (
    <View style={{ flex: 1 }}>
      <Header title="Ajustes" />
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={st.h}>Tu cuenta</Text>
          <Text style={{ color: C.fg, fontSize: 15 }}>{account?.name}</Text>
          <Text style={s.sub}>{account?.email}</Text>
          <Text style={[s.sub, { color: C.ok, fontWeight: '700' }]}>
            {isOwner ? '● Tus medicamentos e historial están guardados en la nube.' : `● Estás acompañando la medicación de ${set.patientName || 'tu familiar'}.`}
          </Text>
          {confirm === 'signout' ? (
            <ConfirmRow text="¿Cerrar sesión en este teléfono? Tus datos siguen guardados en tu cuenta." yes="Cerrar sesión" onYes={() => run('signout', signOut)} onNo={() => setConfirm(null)} />
          ) : (
            <Btn kind="soft" small title="Cerrar sesión" onPress={() => setConfirm('signout')} />
          )}
        </Card>

        <Card>
          <Text style={st.h}>Datos del paciente</Text>
          {profile?.fullName ? (
            <>
              <Text style={{ color: C.fg, fontSize: 16, fontWeight: '700' }}>{profile.fullName}</Text>
              <Text style={s.sub}>
                {[
                  ageFrom(profile.birthDate) != null ? `${ageFrom(profile.birthDate)} años (${fmtDateShort(profile.birthDate)})` : '',
                  SEX_TXT[profile.sex] ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Sin fecha de nacimiento'}
              </Text>
              {!!profile.allergies && <Text style={s.sub}>Alergias: {profile.allergies}</Text>}
              {!!profile.conditions && <Text style={s.sub}>Condiciones: {profile.conditions}</Text>}
              {!!profile.emergencyName && <Text style={s.sub}>Emergencia: {profile.emergencyName} {profile.emergencyPhone}</Text>}
            </>
          ) : (
            <Text style={s.sub}>Nombre completo, edad, alergias y enfermedades. Aparecen en el informe para el médico.</Text>
          )}
          <Btn kind={profile?.fullName ? 'soft' : 'primary'} small title={profile?.fullName ? 'Editar datos' : 'Completar datos del paciente'} onPress={() => router.push('/datos-paciente')} />
        </Card>

        <Card>
          <Text style={st.h}>{isOwner ? 'Persona que toma la medicación' : 'Medicación que acompañas'}</Text>
          <TextInput
            style={st.input}
            value={name}
            onChangeText={setName}
            onBlur={() => name.trim() !== set.patientName && setPatientName(name)}
            placeholder="Nombre"
            editable={isOwner}
          />
          <Row label="Leer los avisos en voz alta en este teléfono" value={set.voice} onChange={setVoice} />
        </Card>

        <AvisosCheck />

        {isOwner ? (
          <Card>
            <Text style={st.h}>Compartir con un familiar</Text>
            <Text style={s.sub}>
              Tu familiar verá desde su teléfono tus medicamentos, las tomas confirmadas y el historial, y recibirá un aviso de SaludAsist si una dosis lleva más de 1 hora sin registrarse.
            </Text>
            {code ? (
              <>
                <Text style={st.code} selectable>
                  {code}
                </Text>
                <Text style={[s.sub, { textAlign: 'center' }]}>
                  Tu familiar entra en SaludAsist con su cuenta de Google, elige «Soy familiar y tengo un código» y escribe este código. Vale durante {INVITE_HOURS} horas.
                </Text>
                <Btn title="Enviar código" onPress={() => shareCode(code)} />
              </>
            ) : (
              <Btn
                title={busy === 'code' ? 'Creando código…' : 'Crear código de invitación'}
                loading={busy === 'code'}
                onPress={() =>
                  run('code', async () => {
                    setCode(await createInvite());
                  })
                }
              />
            )}
            <Text style={[st.h, { fontSize: 15, marginTop: 4 }]}>Familiares con acceso</Text>
            {family.length === 0 ? (
              <Text style={s.sub}>Todavía nadie. Crea un código y envíaselo.</Text>
            ) : (
              family.map(([uid, m]) => (
                <View key={uid} style={st.member}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.fg, fontWeight: '700' }}>{m.name}</Text>
                    <Text style={s.sub}>{m.email}</Text>
                  </View>
                  {confirm === uid ? (
                    <ConfirmRow text={`¿Quitar a ${m.name}?`} yes="Quitar" onYes={() => run(uid, () => removeMember(uid)).then(() => setConfirm(null))} onNo={() => setConfirm(null)} />
                  ) : (
                    <Btn kind="danger" small title="Quitar" onPress={() => setConfirm(uid)} />
                  )}
                </View>
              ))
            )}
          </Card>
        ) : (
          <Card>
            <Text style={st.h}>Avisos de la familia</Text>
            <Text style={s.sub}>
              Recibirás una notificación de SaludAsist cuando {set.patientName || 'tu familiar'} confirme una toma, si la foto no se pudo verificar o si una dosis lleva más de 1 hora sin registrarse. Con la app cerrada, Android revisa cada 15-30 minutos.
            </Text>
            <Text style={s.sub}>Para que lleguen a tiempo: Ajustes del teléfono → Apps → SaludAsist → Ahorro de batería → Sin restricciones.</Text>
            {confirm === 'leave' ? (
              <ConfirmRow text={`¿Dejar de acompañar la medicación de ${set.patientName || 'tu familiar'}?`} yes="Dejar de seguir" onYes={() => run('leave', leave)} onNo={() => setConfirm(null)} />
            ) : (
              <Btn kind="danger" small title="Dejar de seguir" onPress={() => setConfirm('leave')} />
            )}
          </Card>
        )}

        <Card>
          <Text style={st.h}>Inteligencia artificial</Text>
          <Text style={s.sub}>
            La verificación de fotos y el asistente usan Gemini, de Google, en su plan gratuito. Google puede usar las fotos y preguntas para mejorar sus productos.
          </Text>
        </Card>

        <Card>
          <Text style={st.h}>Versión de la app</Text>
          <Text style={{ color: C.fg }}>SaludAsist {installedVersionName()}</Text>
          {upd && upd !== 'none' ? (
            <>
              <Text style={{ color: C.ok, fontWeight: '700' }}>Hay una versión nueva: {upd.versionName}</Text>
              <Btn kind="ok" small title="Actualizar" onPress={() => openUpdate(upd)} />
            </>
          ) : (
            <Btn
              kind="soft"
              small
              title={busy === 'upd' ? 'Buscando…' : upd === 'none' ? 'Ya tienes la última versión' : 'Buscar actualizaciones'}
              loading={busy === 'upd'}
              onPress={() =>
                run('upd', async () => {
                  setUpd((await checkForUpdate()) ?? 'none');
                })
              }
            />
          )}
        </Card>

        {!!msg && <Text style={{ color: C.bad, textAlign: 'center' }}>{msg}</Text>}
        <Btn kind="soft" small title="Política de privacidad de Google" onPress={() => Linking.openURL('https://policies.google.com/privacy')} />
        <Text style={[s.sub, { textAlign: 'center' }]}>SaludAsist ayuda a recordar la medicación; no sustituye el consejo de tu médico o farmacéutico.</Text>
      </ScrollView>
    </View>
  );
}

function ConfirmRow({ text, yes, onYes, onNo }: { text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <Text style={{ color: C.bad }}>{text}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn kind="soft" small title="Cancelar" onPress={onNo} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn kind="danger" small title={yes} onPress={onYes} />
        </View>
      </View>
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 15, color: C.fg }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
    </View>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '800', color: C.fg },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.fg, backgroundColor: C.surface2 },
  code: { fontSize: 38, fontWeight: '900', letterSpacing: 8, textAlign: 'center', color: C.brandDeep, backgroundColor: C.surface2, borderRadius: 12, paddingVertical: 14, fontFamily: 'monospace' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
});
