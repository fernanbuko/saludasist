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
  /** "fabricante marca" en minúsculas, p. ej. "infinix infinix". */
  manufacturer(): string;
  /** ¿Tiene este teléfono una pantalla de «Inicio automático» conocida? */
  hasAutostart(): boolean;
  /** Abre la pantalla de «Inicio automático» del fabricante; false si no existe. */
  openAutostart(): boolean;
  openBatterySettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  /** Notificación fija que mantiene activos los recordatorios. */
  setKeepAlive(on: boolean): void;
  keepAliveOn(): boolean;
  startKeepAlive(): void;
  stopKeepAlive(): void;
  /** JSON: [{ id, title, at, reason }] de las alarmas que no llegaron a sonar. */
  missedAlarms(): string;
  clearMissed(): void;
  /** Registro de las últimas acciones de la alarma (programada, recibida, sonando, errores). */
  diagnostics(): string;
  logSummary(): void;
}

export default requireOptionalNativeModule<SaludasistAlarmModule>('SaludasistAlarm');
