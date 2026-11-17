import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon } from '../components/art';
import { Btn, Card, Header, ScreenTitle, s } from '../components/ui';
import { ageFrom, dkey, fmtDateShort } from '../lib/dose';
import { useApp } from '../lib/store';
import type { PatientProfile, Sex } from '../lib/types';
import { C } from '../theme';

/** Ficha del paciente: se usa en el informe para el médico y la ve también la familia. */
export default function DatosPaciente() {
  const { primera } = useLocalSearchParams<{ primera?: string }>();
  const first = primera === '1';
  const { profile, state, saveProfile, setPatientName } = useApp();
  const p = profile;
  const [fullName, setFullName] = useState(p?.fullName || state.settings.patientName || '');
  const [birthDate, setBirthDate] = useState(p?.birthDate ?? '');
  const [sex, setSex] = useState<Sex>(p?.sex ?? '');
  const [allergies, setAllergies] = useState(p?.allergies ?? '');
  const [conditions, setConditions] = useState(p?.conditions ?? '');
  const [doctor, setDoctor] = useState(p?.doctor ?? '');
  const [emergencyName, setEmergencyName] = useState(p?.emergencyName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(p?.emergencyPhone ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const age = ageFrom(birthDate);

  const pickDate = () => {
    const d = birthDate ? new Date(`${birthDate}T12:00`) : new Date(1950, 0, 1, 12);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'date',
      maximumDate: new Date(),
      minimumDate: new Date(1900, 0, 1),
      onChange: (e, date) => {
        if (e.type === 'set' && date) setBirthDate(dkey(date));
      },
    });
  };

  const done = () => router.replace(first ? '/saludo' : '/(tabs)/ajustes');

  const save = async () => {
    if (!fullName.trim()) {
      setMsg('Escribe al menos el nombre y apellidos.');
      return;
    }
    setBusy(true);
    setMsg('');
    const prof: PatientProfile = {
      fullName: fullName.trim(),
      birthDate,
      sex,
      allergies: allergies.trim(),
      conditions: conditions.trim(),
      doctor: doctor.trim(),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
    };
    try {
      await saveProfile(prof);
      // Si aún no había nombre para los saludos, usar el primer nombre.
      if (!state.settings.patientName) setPatientName(prof.fullName.split(' ')[0]);
      if (first) done();
      else router.back();
    } catch {
      setMsg('No se pudo guardar. Revisa tu conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="SaludAsist" back={!first} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
          <ScreenTitle>Datos del paciente</ScreenTitle>
          <Text style={[s.sub, { textAlign: 'center', fontSize: 14 }]}>
            Aparecen en el informe para el médico. {first ? 'Puedes completarlos ahora o más tarde en Ajustes.' : ''}
          </Text>
          <Card>
            <Field label="Nombre y apellidos">
              <TextInput style={st.input} value={fullName} onChangeText={setFullName} placeholder="Ej. Carmen López García" autoCapitalize="words" />
            </Field>
            <Field label="Fecha de nacimiento">
              <Pressable onPress={pickDate} style={st.date} accessibilityRole="button">
                <Icon name="today" color={C.brand} size={22} />
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: birthDate ? C.fg : C.muted }}>{birthDate ? fmtDateShort(birthDate) : 'Elegir fecha'}</Text>
                {age != null && <Text style={{ color: C.brand, fontWeight: '700' }}>{age} años</Text>}
              </Pressable>
            </Field>
            <Field label="Sexo (opcional)">
              <View style={st.chips}>
                {(
                  [
                    ['F', 'Mujer'],
                    ['M', 'Hombre'],
                    ['O', 'Otro'],
                  ] as [Sex, string][]
                ).map(([v, l]) => (
                  <Pressable key={v} onPress={() => setSex(sex === v ? '' : v)} style={[st.chip, sex === v && st.chipOn]} accessibilityState={{ selected: sex === v }}>
                    <Text style={[st.chipText, sex === v && { color: '#fff' }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </Card>
          <Card>
            <Field label="Alergias">
              <TextInput style={st.input} value={allergies} onChangeText={setAllergies} placeholder="Ej. Penicilina (o «Ninguna conocida»)" multiline />
            </Field>
            <Field label="Enfermedades o condiciones">
              <TextInput style={st.input} value={conditions} onChangeText={setConditions} placeholder="Ej. Hipertensión, diabetes tipo 2" multiline />
            </Field>
            <Field label="Médico o centro de salud (opcional)">
              <TextInput style={st.input} value={doctor} onChangeText={setDoctor} placeholder="Ej. Dra. Pérez – Centro de Salud Norte" />
            </Field>
          </Card>
          <Card>
            <Field label="Contacto de emergencia (opcional)">
              <TextInput style={st.input} value={emergencyName} onChangeText={setEmergencyName} placeholder="Nombre y parentesco, ej. Fernando (hijo)" />
              <TextInput style={st.input} value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="Teléfono" keyboardType="phone-pad" />
            </Field>
          </Card>
          {!!msg && <Text style={{ color: C.bad, textAlign: 'center' }}>{msg}</Text>}
          <Btn title={busy ? 'Guardando…' : 'Guardar'} loading={busy} onPress={save} />
          {first && <Btn kind="soft" title="Más tarde" onPress={done} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 15, color: C.fg }}>{label}</Text>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.fg, backgroundColor: C.surface },
  date: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: C.chip, borderColor: C.chip },
  chipText: { fontWeight: '700', color: C.muted, fontSize: 14 },
});
