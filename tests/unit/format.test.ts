import { describe, expect, it } from 'vitest';
import { formatComments, formatCountdown } from '../../web/src/lib/format';

describe('formatComments', () => {
  it('singular y plural', () => {
    expect(formatComments(0)).toBe('0 comentarios');
    expect(formatComments(1)).toBe('1 comentario');
    expect(formatComments(2)).toBe('2 comentarios');
  });
});

describe('formatCountdown', () => {
  it('muestra horas y minutos', () => {
    expect(formatCountdown(24 * 60 * 60 * 1000)).toBe('24h 0m');
    expect(formatCountdown(60 * 60 * 1000)).toBe('1h 0m');
  });

  it('muestra minutos y segundos bajo una hora', () => {
    expect(formatCountdown(61_000)).toBe('1m 1s');
    expect(formatCountdown(5_000)).toBe('5s');
  });

  it('muestra expirado en cero o negativo', () => {
    expect(formatCountdown(0)).toBe('Expirado');
    expect(formatCountdown(-1)).toBe('Expirado');
  });
});
