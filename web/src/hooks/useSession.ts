import { useCallback, useEffect, useState } from 'react';
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginData,
  type RegisterData,
  type User,
} from '../api/client';

type SessionState = {
  user: User | null;
  loading: boolean;
};

const initialState: SessionState = {
  user: null,
  loading: true,
};

/**
 * Sesión del visitante. Un 401 en /me es el estado normal de un anónimo, no un
 * error visible; los fallos de red tampoco bloquean la lectura del muro.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>(initialState);

  useEffect(() => {
    let active = true;

    getMe()
      .then((user) => {
        if (active) {
          setState({ user, loading: false });
        }
      })
      .catch(() => {
        // Un 401 es el estado normal de un anónimo; un fallo de red tampoco
        // debe romper la lectura del muro.
        if (active) {
          setState({ user: null, loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (data: LoginData): Promise<User> => {
    const user = await loginRequest(data);
    setState({ user, loading: false });
    return user;
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<User> => {
    const user = await registerRequest(data);
    setState({ user, loading: false });
    return user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest();
    setState({ user: null, loading: false });
  }, []);

  return { ...state, login, register, logout };
}
