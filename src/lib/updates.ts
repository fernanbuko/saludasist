import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { readAppConfig } from './cloud';

/**
 * Aviso de actualización. La última versión se publica en GitHub, rama "descargas" de fernanbuko/saludasist
 * (scripts/publicar-version.sh), con:
 *   - SaludAsist.apk  → el instalador
 *   - version.json    → { versionCode, versionName, notes }
 * La app lee version.json y, si la versión es mayor que la instalada, ofrece descargar el APK.
 * Como respaldo, también mira Firestore (config/app).
 */
const REPO = 'fernanbuko/saludasist';
const LATEST = `https://raw.githubusercontent.com/${REPO}/descargas`;

export const installedVersionCode = (): number => Constants.expoConfig?.android?.versionCode ?? 0;
export const installedVersionName = (): string => Constants.expoConfig?.version ?? '';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

async function fromGitHub(): Promise<UpdateInfo | null> {
  try {
    const r = await fetch(`${LATEST}/version.json?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return null;
    const v = (await r.json()) as Partial<UpdateInfo>;
    if (!Number(v.versionCode)) return null;
    return { versionCode: Number(v.versionCode), versionName: String(v.versionName ?? ''), notes: v.notes, apkUrl: v.apkUrl || `${LATEST}/SaludAsist.apk` };
  } catch {
    return null;
  }
}

async function fromFirestore(): Promise<UpdateInfo | null> {
  const cfg = await readAppConfig();
  if (!cfg || !cfg.apkUrl || !Number(cfg.versionCode)) return null;
  return { ...cfg, versionCode: Number(cfg.versionCode) };
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const found = [await fromGitHub(), await fromFirestore()].filter((u): u is UpdateInfo => !!u);
  const best = found.sort((a, b) => b.versionCode - a.versionCode)[0];
  return best && best.versionCode > installedVersionCode() ? best : null;
}

/** Abre la descarga del APK; Android pide confirmar la instalación al terminar. */
export const openUpdate = (u: UpdateInfo) => Linking.openURL(u.apkUrl);

export function useUpdate(enabled: boolean) {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    checkForUpdate().then(setUpdate).catch(() => {});
  }, [enabled]);
  return update;
}
