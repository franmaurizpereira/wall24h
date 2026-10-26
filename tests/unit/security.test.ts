import { describe, expect, it } from 'vitest';
import { safeErrorForLog } from '../../src/lib/security.js';

describe('safeErrorForLog', () => {
  it('solo conserva metadatos seguros', () => {
    const error = Object.assign(new Error('contenido_prohibido y un secreto'), {
      code: 'XX000',
      constraint: 'uq_messages_active_per_user',
      statusCode: 500,
      detail: 'password=secreto',
      query: 'SELECT * FROM users',
      parameters: ['secreto'],
    });

    const safe = safeErrorForLog(error);

    expect(safe).toEqual({
      name: 'Error',
      code: 'XX000',
      constraint: 'uq_messages_active_per_user',
      statusCode: 500,
    });
    expect(JSON.stringify(safe)).not.toContain('secreto');
    expect(JSON.stringify(safe)).not.toContain('contenido_prohibido');
    expect(JSON.stringify(safe)).not.toContain('SELECT');
  });

  it('tolera errores sin metadatos', () => {
    expect(safeErrorForLog(null)).toEqual({
      name: 'Error',
      code: undefined,
      constraint: undefined,
      statusCode: undefined,
    });
  });
});
