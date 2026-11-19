import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doseTxt, fmtTime, STATUS_TXT, statusOf } from '../lib/dose';
import { useApp } from '../lib/store';
import type { DoseInstance, DoseStatus } from '../lib/types';
import { C, shadow, themed } from '../theme';
import { Avatar, Icon, PillIcon } from './art';

export function Header({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <View style={s.headerSide}>
        {back && (
          <Pressable accessibilityLabel="Volver" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Icon name="back" color="#fff" size={26} />
          </Pressable>
        )}
      </View>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={[s.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export const ScreenTitle = ({ children }: { children: string }) => <Text style={s.screenTitle}>{children}</Text>;

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;

export function Speak({ children, size = 76, extra }: { children: React.ReactNode; size?: number; extra?: React.ReactNode }) {
  return (
    <View style={s.speak}>
      <View style={[s.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Avatar size={size} />
      </View>
      <View style={s.bubble}>{typeof children === 'string' ? <Text style={s.bubbleText}>{children}</Text> : children}</View>
      {extra}
    </View>
  );
}

type BtnKind = 'ok' | 'primary' | 'soft' | 'danger';
export function Btn({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: React.ComponentProps<typeof Icon>['name'];
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const bg = { ok: C.ok, primary: C.brand, soft: C.surface2, danger: 'transparent' }[kind];
  const fg = kind === 'soft' ? C.fg : kind === 'danger' ? C.bad : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        kind === 'soft' && { borderWidth: 1, borderColor: C.line },
        kind === 'danger' && { borderWidth: 1, borderColor: C.bad },
        small && { paddingVertical: 10 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} stroke={2.6} /> : null}
      <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
    </Pressable>
  );
}

const STATUS_COLOR: Record<DoseStatus, string> = { due: C.warn, upcoming: C.muted, taken: C.ok, proof: C.warn, missed: C.bad, skipped: C.bad };

export function StatusText({ st }: { st: DoseStatus }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: STATUS_COLOR[st] }} />
      <Text style={{ color: STATUS_COLOR[st], fontWeight: '800', fontSize: 12.5, letterSpacing: 0.6 }}>{STATUS_TXT[st].toUpperCase()}</Text>
    </View>
  );
}

export function DoseRow({ inst }: { inst: DoseInstance }) {
  const { state, markDose } = useApp();
  const st = statusOf(state, inst);
  const e = state.log[inst.key];
  const goValidate = () => router.push({ pathname: '/validar', params: { key: inst.key } });
  let act: React.ReactNode;
  if (st === 'due' || st === 'missed')
    act = (
      <>
        <Round bg={C.ok} icon="check" label="Marcar como tomada" onPress={goValidate} />
        <Round bg={C.surface2} fg={C.muted} icon="x" label="Omitir" onPress={() => markDose(inst.key, 'skipped')} />
      </>
    );
  else if (st === 'proof') act = <Round bg={C.brand} icon="camera" label="Subir comprobante" onPress={goValidate} />;
  else if (st === 'taken') act = <Round bg={C.ok} icon="check" label="Tomada" />;
  else if (st === 'skipped') act = <Round bg={C.bad} icon="x" label="Omitida" />;
  else act = <Round bg={C.surface2} fg={C.muted} icon="clock" label="Programada" />;
  return (
    <View style={s.dose}>
      <PillIcon color={inst.med.color} type={inst.med.type} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.doseName}>{inst.med.name}</Text>
        <Text style={s.meta}>
          {doseTxt(inst.med)} · {fmtTime(inst.time)}
          {e?.verified ? ' · verificada con foto' : ''}
        </Text>
        <StatusText st={st} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{act}</View>
    </View>
  );
}

function Round({ bg, fg = '#fff', icon, label, onPress }: { bg: string; fg?: string; icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} disabled={!onPress} onPress={onPress} hitSlop={6} style={[s.round, { backgroundColor: bg }, bg === C.surface2 && { borderWidth: 1, borderColor: C.line }]}>
      <Icon name={icon} color={fg} size={18} stroke={2.8} />
    </Pressable>
  );
}

export const s = themed(() => ({
  header: { backgroundColor: C.header, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  headerSide: { width: 44 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: '800' },
  screenTitle: { fontSize: 24, fontWeight: '900', color: C.brand, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3, marginVertical: 4 },
  card: { backgroundColor: C.surface, borderRadius: 18, padding: 16, gap: 14, ...shadow },
  speak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { overflow: 'hidden', borderWidth: 3, borderColor: C.surface, backgroundColor: C.surface2, ...shadow },
  bubble: { flex: 1, backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 12 },
  bubbleText: { fontSize: 16, color: C.fg, lineHeight: 22 },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  dose: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 16, padding: 12, ...shadow },
  doseName: { fontSize: 16, fontWeight: '800', color: C.fg },
  meta: { fontSize: 13, color: C.muted },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  facts: { backgroundColor: C.surface2, borderRadius: 14, padding: 14, gap: 4 },
  fact: { fontSize: 16, color: C.fg },
  factLabel: { fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' },
  screen: { padding: 16, gap: 14, paddingBottom: 32 },
  sub: { fontSize: 13, color: C.muted, lineHeight: 18 },
}));
