import { requireOptionalNativeModule } from 'expo';

/** Alarma a pantalla completa (solo Android). Es null si el módulo nativo no está disponible. */
export interface SaludasistAlarmModule {
  /** Programa una alarma exacta. `id` identifica la toma (su clave) para poder cancelarla. */
  schedule(id: string, atMs: number, title: string, detail: string, time: string, speak: boolean): void;
  cancel(id: string): void;
  cancelAll(): void;
  scheduledCount(): number;
  /** Lanza la alarma de prueba dentro de `seconds` segundos. */
  test(seconds: number): void;
  canUseFullScreenIntent(): boolean;
  canScheduleExactAlarms(): boolean;
  openFullScreenSettings(): void;
  openExactAlarmSettings(): void;
  openXiaomiAutostart(): void;
  openXiaomiBattery(): void;
  /** Registro de las últimas acciones de la alarma (programada, recibida, sonando, errores). */
  diagnostics(): string;
}

export default requireOptionalNativeModule<SaludasistAlarmModule>('SaludasistAlarm');
