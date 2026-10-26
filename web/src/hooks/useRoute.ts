import { useCallback, useEffect, useState } from 'react';

function parseMessageId(pathname: string): number | null {
  const match = /^\/messages\/(\d+)\/?$/.exec(pathname);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Router mínimo sin dependencias: / y /messages/:id. Fastify sirve index.html
 * para las rutas del cliente y aquí se resuelve el estado de navegación.
 */
export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: string) => {
    if (next !== window.location.pathname) {
      window.history.pushState({}, '', next);
      setPathname(next);
    }
    window.scrollTo(0, 0);
  }, []);

  return {
    pathname,
    isAdmin: pathname === '/admin',
    messageId: parseMessageId(pathname),
    navigate,
  };
}
