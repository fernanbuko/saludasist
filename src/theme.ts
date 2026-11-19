import { StyleSheet } from 'react-native';

/**
 * Colores de la app, en modo claro y oscuro.
 * `C` es un objeto único que cambia de valores al cambiar de modo (applyTheme); al cambiar, la app se vuelve a dibujar entera.
 */
const LIGHT = {
  brand: '#3A6EA5',
  brandDeep: '#2B5687',
  bg: '#E9F1FA',
  surface: '#FFFFFF',
  surface2: '#F3F7FC',
  line: '#D3E0EF',
  fg: '#1C2B3D',
  muted: '#5B6E85',
  ok: '#3E9B4F',
  okSoft: '#DDF1E1',
  warn: '#D9822B',
  warnSoft: '#FBEBD9',
  bad: '#C94040',
  badSoft: '#F8DEDE',
  chip: '#4A7DB5',
  water: '#5AA9E6',
  header: '#3A6EA5', // cabecera y pantallas de saludo
};

const DARK: typeof LIGHT = {
  brand: '#4C82C0',
  brandDeep: '#22446B',
  bg: '#0E151E',
  surface: '#17212D',
  surface2: '#1F2B39',
  line: '#2D3B4C',
  fg: '#E6EDF5',
  muted: '#9AACC0',
  ok: '#43A355',
  okSoft: '#1C3324',
  warn: '#E39A4E',
  warnSoft: '#3A2B1A',
  bad: '#D85A5A',
  badSoft: '#3A1F23',
  chip: '#4C82C0',
  water: '#4A9AD8',
  header: '#1C3553',
};

export const C = { ...LIGHT };

let dark = false;
let version = 0;

export const isDark = () => dark;

/** Cambia la paleta. Devuelve true si cambió. */
export function applyTheme(d: boolean): boolean {
  if (d === dark) return false;
  dark = d;
  version++;
  Object.assign(C, d ? DARK : LIGHT);
  return true;
}

/**
 * Como StyleSheet.create, pero los estilos se recalculan al cambiar de modo claro/oscuro.
 * Se usa igual: `const st = themed(() => ({ ... }))` y luego `st.card`.
 */
type Styles = Parameters<typeof StyleSheet.create>[0];

export function themed<T extends Styles>(fn: () => T & Styles): Readonly<T> {
  let cache: { v: number; s: T } | null = null;
  const get = (): T => {
    if (!cache || cache.v !== version) cache = { v: version, s: StyleSheet.create(fn()) as T };
    return cache.s;
  };
  return new Proxy({} as object, {
    get: (_t, k) => (get() as Record<string | symbol, unknown>)[k],
    has: (_t, k) => k in (get() as object),
    ownKeys: () => Reflect.ownKeys(get() as object),
    getOwnPropertyDescriptor: (_t, k) => {
      const d = Reflect.getOwnPropertyDescriptor(get() as object, k);
      return d ? { ...d, configurable: true } : undefined;
    },
  }) as T;
}

export const shadow = {
  shadowColor: '#1E3C64',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};
