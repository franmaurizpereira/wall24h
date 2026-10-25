import { useEffect } from 'react';

export const POLL_INTERVAL_MS = 15_000;

/**
 * Ejecuta `callback` cada `intervalMs` solo mientras la pestaña está visible.
 * Al volver a la pestaña hace un refresh inmediato para no mostrar datos
 * obsoletos.
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs = POLL_INTERVAL_MS) {
  useEffect(() => {
    let intervalId: number | null = null;

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(() => {
          void callback();
        }, intervalMs);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }

      void callback();
      start();
    };

    if (!document.hidden) {
      start();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [callback, intervalMs]);
}
