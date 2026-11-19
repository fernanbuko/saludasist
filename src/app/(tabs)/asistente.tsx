import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { speak } from '../../lib/voice';
import { Avatar, Icon } from '../../components/art';
import { Header, s } from '../../components/ui';
import { AiError, askAssistant, type ChatTurn } from '../../lib/ai';
import { useApp } from '../../lib/store';
import { C } from '../../theme';

const SUGGESTIONS = ['¿Qué me falta tomar hoy?', '¿Cómo voy esta semana?', '¿Se me olvidó alguna ayer?', '¿Qué hago si olvidé una pastilla?'];

export default function Asistente() {
  const { state, profile } = useApp();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setBusy(true);
    try {
      const answer = await askAssistant(state, next, profile);
      setTurns([...next, { role: 'assistant', content: answer }]);
      if (state.settings.voice) speak(answer);
    } catch (e) {
      setTurns([...next, { role: 'assistant', content: e instanceof AiError ? e.message : 'No pude responder ahora. Inténtalo otra vez.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Asistente" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={[s.screen, { gap: 10 }]} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <AiMsg text="Hola, soy tu asistente de SaludAsist. Puedo decirte qué dosis te faltan, cómo vas con el tratamiento o ayudarte con tus horarios. Para cambiar una dosis consulta siempre a tu médico o farmacéutico." />
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <View key={i} style={st.me}>
                <Text style={{ color: '#fff', fontSize: 16 }}>{t.content}</Text>
              </View>
            ) : (
              <AiMsg key={i} text={t.content} />
            ),
          )}
          {busy && <AiMsg text="Pensando…" />}
          {!turns.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map((q) => (
                <Pressable key={q} style={st.sug} onPress={() => send(q)}>
                  <Text style={{ color: C.fg }}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={st.composer}>
          <TextInput style={st.input} value={input} onChangeText={setInput} placeholder="Escribe tu pregunta…" multiline onSubmitEditing={() => send(input)} />
          <Pressable accessibilityLabel="Enviar" disabled={busy || !input.trim()} onPress={() => send(input)} style={[st.send, (busy || !input.trim()) && { opacity: 0.5 }]}>
            <Icon name="send" color="#fff" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function AiMsg({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%' }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden' }}>
        <Avatar size={36} />
      </View>
      <Pressable style={st.ai} onLongPress={() => speak(text)}>
        <Text style={{ color: C.fg, fontSize: 16, lineHeight: 22 }}>{text}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  me: { alignSelf: 'flex-end', backgroundColor: C.brand, borderRadius: 16, borderBottomRightRadius: 4, padding: 12, maxWidth: '85%' },
  ai: { flexShrink: 1, backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12 },
  sug: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  composer: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg, alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: C.surface, color: C.fg },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
});
