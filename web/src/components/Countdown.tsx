import { useEffect, useMemo, useState } from 'react';
import { formatCountdown } from '../lib/format';

type Props = {
  expiresAt: string;
  serverTime: string;
  onExpire?: () => void;
};

/**
 * Cuenta atrás basada en el reloj del servidor. `serverTime` llega con cada
 * fetch del muro; el offset evita depender del reloj local del visitante.
 */
export function Countdown({ expiresAt, serverTime, onExpire }: Props) {
  const serverOffset = useMemo(() => Date.now() - Date.parse(serverTime), [serverTime]);
  const [remaining, setRemaining] = useState(() => Date.parse(expiresAt) - Date.parse(serverTime));

  useEffect(() => {
    const update = () => {
      const next = Date.parse(expiresAt) - (Date.now() - serverOffset);
      setRemaining(next);

      if (next <= 0) {
        window.clearInterval(id);
        onExpire?.();
      }
    };

    const id = window.setInterval(update, 1000);

    return () => window.clearInterval(id);
  }, [expiresAt, serverOffset, onExpire]);

  const expired = remaining <= 0;
  const className = expired
    ? 'countdown countdown--expired'
    : remaining < 60 * 60 * 1000
      ? 'countdown countdown--urgent'
      : 'countdown';

  return (
    <time
      className={className}
      dateTime={expiresAt}
      data-testid="countdown"
      aria-label="Tiempo restante"
    >
      {formatCountdown(remaining)}
    </time>
  );
}
