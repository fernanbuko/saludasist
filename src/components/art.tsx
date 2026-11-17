import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { MedType } from '../lib/types';

/** Avatar del asistente (enfermero con gafas). */
export function Avatar({ size = 76 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect width="120" height="120" fill="#D7E7F7" />
      <Path d="M18 120c2-24 20-34 42-34s40 10 42 34z" fill="#4C87C4" />
      <Path d="M48 88l12 14 12-14" fill="#fff" />
      <Path d="M44 92c-6 8-6 18 2 22M76 92c6 8 4 16-2 20" stroke="#29425E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Circle cx="74" cy="113" r="4" fill="#9FB6CF" stroke="#29425E" strokeWidth="2" />
      <Rect x="52" y="74" width="16" height="16" rx="6" fill="#E9B48F" />
      <Ellipse cx="60" cy="56" rx="24" ry="27" fill="#F2C29D" />
      <Ellipse cx="36" cy="58" rx="4" ry="6" fill="#E9B48F" />
      <Ellipse cx="84" cy="58" rx="4" ry="6" fill="#E9B48F" />
      <Path d="M35 52c-3-20 10-30 26-30 17 0 28 10 24 30-3-8-8-13-14-14-8 6-22 6-30 3-3 3-5 7-6 11z" fill="#3A2B25" />
      <G fill="none" stroke="#2A2F3A" strokeWidth="2.6">
        <Rect x="40" y="52" width="16" height="12" rx="5" />
        <Rect x="64" y="52" width="16" height="12" rx="5" />
        <Path d="M56 57h8" />
      </G>
      <Circle cx="48" cy="58" r="2.4" fill="#2A2F3A" />
      <Circle cx="72" cy="58" r="2.4" fill="#2A2F3A" />
      <Path d="M51 71c5 5 13 5 18 0" stroke="#A4573E" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <Ellipse cx="44" cy="68" rx="4" ry="2.4" fill="#F0A58D" opacity={0.6} />
      <Ellipse cx="76" cy="68" rx="4" ry="2.4" fill="#F0A58D" opacity={0.6} />
    </Svg>
  );
}

export function PillIcon({ color, type, size = 40 }: { color: string; type: MedType; size?: number }) {
  if (type === 'liquid')
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="22" y="6" width="20" height="9" rx="2" fill={color} />
        <Path d="M18 18h28v38a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#F3F7FC" stroke="#D3E0EF" strokeWidth="2" />
        <Path d="M19 34h26v22a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3z" fill={color} opacity={0.85} />
      </Svg>
    );
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G rotation={-40} origin="32, 32">
        <Path d="M32 18H20a14 14 0 0 0 0 28h12z" fill={color} />
        <Path d="M32 18h12a14 14 0 0 1 0 28H32z" fill="#F3F7FC" stroke="#D3E0EF" strokeWidth="2" />
        <Path d="M14 26a8 8 0 0 1 6-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity={0.6} fill="none" />
      </G>
    </Svg>
  );
}

export function Blister({ size = 90, color = '#3A6EA5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none" stroke={color} strokeWidth={3}>
      <Rect x="14" y="6" width="52" height="68" rx="8" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1].map((c) => (
          <G key={`${r}${c}`}>
            <Circle cx={30 + c * 20} cy={22 + r * 18} r="7" strokeWidth={2.6} />
            <Path d={`M${25 + c * 20} ${27 + r * 18}l10-10`} strokeWidth={2.6} />
          </G>
        )),
      )}
    </Svg>
  );
}

export function Shield({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M32 4l22 8v16c0 15-10 26-22 31C20 54 10 43 10 28V12z" />
      <Path d="M32 16v36" />
      <Path d="M24 22c4-3 12-3 16 0M22 18c-3 1-5 3-5 3s4 3 9 2M42 18c3 1 5 3 5 3s-4 3-9 2" />
      <Path d="M27 30c6 0 10 2 10 5s-10 3-10 6 4 5 10 5" />
    </Svg>
  );
}

type IconName = 'today' | 'history' | 'meds' | 'assistant' | 'settings' | 'check' | 'x' | 'camera' | 'clock' | 'speaker' | 'send' | 'plus' | 'back' | 'image';

const PATHS: Record<IconName, string> = {
  today: 'M6 4.5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3zM3 9.5h18M8 3v3M16 3v3M9 15l2 2 4-4',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  meds: 'M4.2 15.4l7.2-10.3a4 4 0 0 1 6.6 4.6l-7.2 10.3a4 4 0 0 1-6.6-4.6zM7.8 10.3l6.6 4.6',
  assistant: 'M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM3 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M18 3.5c1.4.8 2.3 2.2 2.3 3.8s-.9 3-2.3 3.8',
  settings:
    'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 10a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  speaker: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  send: 'M4 12l16-8-6 16-2-7z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 16l5-5 4 4 3-3 6 6M15.5 8.5a1 1 0 1 1 0 .01',
};

export function Icon({ name, size = 22, color = '#000', stroke = 2.2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  );
}
