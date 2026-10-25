import { useCallback, useEffect, useState } from 'react';
import { getWall, type WallResponse } from '../api/client';

type WallState = {
  data: WallResponse | null;
  loading: boolean;
  error: string | null;
};

const initialState: WallState = {
  data: null,
  loading: true,
  error: null,
};

/**
 * Carga el muro y expone un refresh manual. T11 añadirá el polling sobre esta
 * misma función para no duplicar la lógica de red.
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
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el muro',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
