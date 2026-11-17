/**
 * Funciones del navegador que usa la librería de IA de Firebase y que el motor de JavaScript
 * de la app (Hermes) no trae. Sin ellas, la verificación de fotos falla siempre.
 */
const g = globalThis as unknown as { DOMException?: unknown; AbortSignal?: { any?: unknown } };

if (typeof g.DOMException === 'undefined') {
  g.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  };
}

if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as unknown as { any?: unknown }).any !== 'function') {
  (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any = (signals: AbortSignal[]) => {
    const ctrl = new AbortController();
    for (const s of signals) {
      if (!s) continue;
      if (s.aborted) {
        ctrl.abort((s as AbortSignal & { reason?: unknown }).reason);
        break;
      }
      s.addEventListener('abort', () => ctrl.abort((s as AbortSignal & { reason?: unknown }).reason));
    }
    return ctrl.signal;
  };
}

export {};
