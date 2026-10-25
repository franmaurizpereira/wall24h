import { expect, test } from '@playwright/test';
import {
  createMessageForUser,
  createSessionContext,
  dbQuery,
  truncateMessages,
} from '../helpers/api';

test.beforeEach(async () => {
  await truncateMessages();
});

test('crea un reporte pending y no expone la cola', async () => {
  const author = await createSessionContext('reportauthor');
  const reporter = await createSessionContext('reporter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje reportable' },
    });
    expect(message.status()).toBe(201);
    const messageBody = (await message.json()) as { id: number };

    const response = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
      data: { reason: 'Contenido ofensivo' },
    });

    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, status: 'pending' });

    const rows = await dbQuery<{ status: string; reason: string }>(
      `SELECT status, reason
       FROM reports
       WHERE message_id = $1 AND reporter_id = $2`,
      [messageBody.id, reporter.user.id],
    );
    expect(rows[0]?.status).toBe('pending');
    expect(rows[0]?.reason).toBe('Contenido ofensivo');

    const queue = await reporter.context.get('/api/reports');
    expect(queue.status()).toBe(404);

    const detail = await reporter.context.get(`/api/messages/${messageBody.id}`);
    expect(detail.status()).toBe(200);
    expect(await detail.json()).not.toHaveProperty('reports');
  } finally {
    await author.context.dispose();
    await reporter.context.dispose();
  }
});

test('no permite reportar el propio mensaje', async () => {
  const author = await createSessionContext('ownreport');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mi mensaje reportable' },
    });
    const messageBody = (await message.json()) as { id: number };

    const response = await author.context.post(`/api/messages/${messageBody.id}/report`, {
      data: { reason: 'Mi propio mensaje' },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('cannot_report_own_message');
  } finally {
    await author.context.dispose();
  }
});

test('un usuario solo puede reportar una vez el mismo mensaje', async () => {
  const author = await createSessionContext('dupemessage');
  const reporter = await createSessionContext('dupereport');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje reportado dos veces' },
    });
    const messageBody = (await message.json()) as { id: number };

    const first = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
      data: { reason: 'Primer motivo' },
    });
    expect(first.status()).toBe(201);

    const second = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
      data: { reason: 'Segundo motivo' },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).code).toBe('already_reported');
  } finally {
    await author.context.dispose();
    await reporter.context.dispose();
  }
});

test('rechaza reportar mensajes vencidos o inexistentes', async () => {
  const author = await createSessionContext('expiredreportauthor');
  const reporter = await createSessionContext('expiredreporter');

  try {
    const expiredId = await createMessageForUser(
      author.user.id,
      'Mensaje vencido para reportar',
      25,
    );

    const expired = await reporter.context.post(`/api/messages/${expiredId}/report`, {
      data: { reason: 'Demasiado tarde' },
    });
    expect(expired.status()).toBe(410);
    expect((await expired.json()).code).toBe('message_gone');

    const missing = await reporter.context.post('/api/messages/999999999/report', {
      data: { reason: 'Fantasma' },
    });
    expect(missing.status()).toBe(410);

    const invalid = await reporter.context.post('/api/messages/abc/report', {
      data: { reason: 'Inválido' },
    });
    expect(invalid.status()).toBe(410);
  } finally {
    await author.context.dispose();
    await reporter.context.dispose();
  }
});

test('valida y modera el motivo del reporte', async () => {
  const author = await createSessionContext('validreportauthor');
  const reporter = await createSessionContext('validreporter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje para validar reportes' },
    });
    const messageBody = (await message.json()) as { id: number };

    for (const reason of ['', '   ', 'abc', 'a'.repeat(501)]) {
      const response = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
        data: { reason },
      });
      expect(response.status()).toBe(422);
      expect((await response.json()).code).toBe('invalid_input');
    }

    const missing = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
      data: {},
    });
    expect(missing.status()).toBe(422);

    const moderated = await reporter.context.post(`/api/messages/${messageBody.id}/report`, {
      data: { reason: 'contenido_prohibido' },
    });
    expect(moderated.status()).toBe(422);
    expect((await moderated.json()).code).toBe('content_not_allowed');
  } finally {
    await author.context.dispose();
    await reporter.context.dispose();
  }
});
