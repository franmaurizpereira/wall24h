import { useCallback, useEffect, useState } from 'react';
import { getWall, type WallResponse } from '../api/client';
import { usePolling } from './usePolling';

type WallState = {
  data: WallResponse | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
};

const initialState: WallState = {
  data: null,
  loading: true,
  error: null,
  stale: false,
};

/**
 * Carga el muro, lo refresca cada 15 s mientras la pestaña está visible y
 * conserva los últimos datos si un refresco falla.
 */
export function useWall() {
  const [state, setState] = useState<WallState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: current.data === null,
      error: null,
    }));

    try {
      const data = await getWall();
      setState({ data, loading: false, error: null, stale: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el muro';
      setState((current) =>
        current.data === null
          ? { data: null, loading: false, error: message, stale: false }
          : { ...current, loading: false, error: null, stale: true },
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(refresh);

  return { ...state, refresh };
}
