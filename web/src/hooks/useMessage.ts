import { useCallback, useEffect, useState } from 'react';
import { ApiError, getMessage, type MessageDetail } from '../api/client';

type MessageState = {
  data: MessageDetail | null;
  loading: boolean;
  error: ApiError | null;
};

export function useMessage(messageId: number) {
  const [state, setState] = useState<MessageState>({
    data: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: current.data === null,
      error: null,
    }));

    try {
      const data = await getMessage(messageId);
      setState({ data, loading: false, error: null });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(0, 'network_error', 'No se pudo cargar el mensaje');
      setState((current) => ({ ...current, loading: false, error: apiError }));
    }
  }, [messageId]);

  useEffect(() => {
    setState({ data: null, loading: true, error: null });
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
