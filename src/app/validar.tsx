import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Blister } from '../components/art';
import { Btn, Header, ScreenTitle, Speak, s } from '../components/ui';
import { AiError, verifyPhoto, type Verdict } from '../lib/ai';
import { doseTxt, findInstance, fmtTime, unitTxt } from '../lib/dose';
import { useApp } from '../lib/store';
import { C } from '../theme';

type Result = { ok: boolean; text: string; conf?: number; error?: boolean; code?: AiError['code'] };

export default function Validar() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { state, markDose, reportRejected, ready } = useApp();
  const inst = key ? findInstance(state, key) : null;
  // La foto se muestra en cuanto vuelve de la cámara; la versión reducida para la IA se prepara en segundo plano.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const prepared = useRef<Promise<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (!ready)
    return (
      <View style={{ flex: 1 }}>
        <Header title="SaludAsist" back />
        <Text style={[s.sub, { padding: 24, textAlign: 'center' }]}>Cargando…</Text>
      </View>
    );
  if (!inst)
    return (
      <View style={{ flex: 1 }}>
        <Header title="SaludAsist" back />
        <Text style={[s.sub, { padding: 24, textAlign: 'center' }]}>No se encontró esta dosis. Puede que el medicamento se haya eliminado.</Text>
      </View>
    );
  const m = inst.med;

  const capture = async (fromGallery = false) => {
    const perm = fromGallery ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setResult({ ok: false, error: true, text: fromGallery ? 'Sin permiso para ver tus fotos. Actívalo en los ajustes del teléfono.' : 'Sin permiso para usar la cámara. Actívalo en los ajustes del teléfono.' });
      return;
    }
    // La cámara ya guarda una foto ligera, así vuelve antes y pesa menos.
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, exif: false };
    const r = fromGallery ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setPhotoUri(a.uri);
    setResult(null);
    setPreparing(true);
    const job = (async () => {
      const ref = await ImageManipulator.manipulate(a.uri).resize(a.width >= a.height ? { width: 1024 } : { height: 1024 }).renderAsync();
      const out = await ref.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
      return out.base64 ?? '';
    })();
    prepared.current = job;
    job.finally(() => prepared.current === job && setPreparing(false)).catch(() => {});
  };

  const verify = async () => {
    if (!photoUri || !prepared.current) return;
    setBusy(true);
    try {
      const base64 = await prepared.current;
      const v: Verdict = await verifyPhoto(inst, base64);
      if (v.verificado) {
        markDose(inst.key, 'taken', { verified: true, aiNote: v.explicacion.slice(0, 200) });
      } else {
        reportRejected(inst.key, v.explicacion);
      }
      setResult({ ok: v.verificado, text: v.explicacion, conf: v.confianza });
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('other', 'No se pudo verificar la foto.');
      setResult({ ok: false, error: true, text: err.message, code: err.code });
    } finally {
      setBusy(false);
    }
  };

  const done = result?.ok;
  const say = done
    ? '¡Toma verificada! Gracias por cuidarte.'
    : photoUri
      ? 'Revisa la foto. Si se ve bien, pulsa “Verificar con IA”.'
      : 'Ahora, por favor, muestra la caja vacía o el blíster vacío a la cámara para confirmar.';

  return (
    <View style={{ flex: 1 }}>
      <Header title="SaludAsist" back />
      <ScrollView contentContainerStyle={s.screen}>
        <ScreenTitle>Validación de toma</ScreenTitle>
        <Speak>{say}</Speak>
        <View style={s.facts}>
          <Text style={s.fact}>
            <Text style={s.factLabel}>{m.name} </Text>
            {doseTxt(m)} · {m.qty} {unitTxt(m)} · {fmtTime(inst.time)}
          </Text>
        </View>

        <Pressable accessibilityLabel="Capturar comprobante" onPress={() => capture(false)} style={st.capture}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Blister size={84} />
              <Text style={s.sub}>Toca para abrir la cámara</Text>
            </View>
          )}
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[st.corner, st[c], { borderColor: photoUri ? '#fff' : C.brand }]} />
          ))}
        </Pressable>

        {result && (
          <View style={[st.verdict, { backgroundColor: result.ok ? C.okSoft : result.error ? C.surface2 : C.badSoft }]}>
            <Text style={st.verdictTitle}>{result.ok ? 'Toma verificada' : result.error ? 'No se pudo verificar' : 'La foto no lo confirma'}</Text>
            <Text style={{ color: C.fg, fontSize: 15 }}>{result.text}</Text>
            {result.conf != null && <Text style={s.sub}>Confianza de la IA: {result.conf}%</Text>}
          </View>
        )}

        <View style={{ gap: 10 }}>
          {done ? (
            <Btn kind="ok" icon="check" title="Listo" onPress={() => router.replace('/(tabs)')} />
          ) : photoUri ? (
            <>
              <Btn title={busy ? 'Verificando…' : preparing ? 'Preparando foto…' : 'Verificar con IA'} loading={busy || preparing} onPress={verify} />
              <Btn kind="soft" icon="camera" title="Repetir foto" onPress={() => capture(false)} disabled={busy} />
            </>
          ) : (
            <>
              <Btn icon="camera" title="Capturar comprobante vacío" onPress={() => capture(false)} />
              <Btn kind="soft" small icon="image" title="Elegir de la galería" onPress={() => capture(true)} />
            </>
          )}
          {!done && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  kind="soft"
                  small
                  title="Foto después"
                  onPress={() => {
                    markDose(inst.key, 'proof');
                    router.replace('/(tabs)');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  kind="soft"
                  small
                  title="Sin foto"
                  onPress={() => {
                    markDose(inst.key, 'taken', { verified: false });
                    router.replace('/(tabs)');
                  }}
                />
              </View>
            </View>
          )}
        </View>
        <Text style={s.sub}>La foto solo se envía a la IA para revisarla; no se guarda en el teléfono ni se comparte con tu familiar.</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  capture: { aspectRatio: 4 / 3, borderRadius: 18, overflow: 'hidden', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#fff', borderWidth: 0 },
  tl: { top: 14, left: 14, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 14, right: 14, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 14, right: 14, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  verdict: { borderRadius: 14, padding: 14, gap: 6 },
  verdictTitle: { fontSize: 17, fontWeight: '800', color: C.fg },
});
