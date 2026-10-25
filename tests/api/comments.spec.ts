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

test('publica un comentario y actualiza detalle, muro y contador', async () => {
  const author = await createSessionContext('author');
  const commenter = await createSessionContext('commenter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje con comentario' },
    });
    expect(message.status()).toBe(201);
    const messageBody = (await message.json()) as { id: number };

    const comment = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: { text: '  Comentario  ' },
    });
    expect(comment.status()).toBe(201);
    const commentBody = (await comment.json()) as { id: number; created_at: string };
    expect(typeof commentBody.id).toBe('number');
    expect(typeof commentBody.created_at).toBe('string');

    const detail = await commenter.context.get(`/api/messages/${messageBody.id}`);
    expect(detail.status()).toBe(200);
    const detailBody = (await detail.json()) as {
      comments_count: number;
      comments: Array<{ content: string; author: string }>;
    };
    expect(detailBody.comments_count).toBe(1);
    expect(detailBody.comments).toHaveLength(1);
    expect(detailBody.comments[0]).toMatchObject({
      content: 'Comentario',
      author: commenter.user.username,
    });

    const wall = await commenter.context.get('/api/wall');
    expect(wall.status()).toBe(200);
    const wallBody = (await wall.json()) as {
      items: Array<{ id: number; comments_count: number; is_top: boolean }>;
    };
    expect(wallBody.items[0]).toMatchObject({
      id: messageBody.id,
      comments_count: 1,
      is_top: true,
    });

    const rows = await dbQuery<{ comments_count: number }>(
      'SELECT comments_count FROM messages WHERE id = $1',
      [messageBody.id],
    );
    expect(rows[0]?.comments_count).toBe(1);
  } finally {
    await author.context.dispose();
    await commenter.context.dispose();
  }
});

test('no permite comentar el propio mensaje', async () => {
  const author = await createSessionContext('own');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mi mensaje' },
    });
    expect(message.status()).toBe(201);
    const messageBody = (await message.json()) as { id: number };

    const comment = await author.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: { text: 'Mi comentario' },
    });

    expect(comment.status()).toBe(403);
    expect((await comment.json()).code).toBe('cannot_comment_on_own_message');
  } finally {
    await author.context.dispose();
  }
});

test('un usuario solo puede comentar una vez por mensaje', async () => {
  const author = await createSessionContext('onceauthor');
  const commenter = await createSessionContext('oncecommenter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje para comentar una vez' },
    });
    const messageBody = (await message.json()) as { id: number };

    const first = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: { text: 'Primer comentario' },
    });
    expect(first.status()).toBe(201);

    const second = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: { text: 'Segundo comentario' },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).code).toBe('already_commented');
  } finally {
    await author.context.dispose();
    await commenter.context.dispose();
  }
});

test('rechaza comentar mensajes vencidos o inexistentes', async () => {
  const author = await createSessionContext('expiredauthor');
  const commenter = await createSessionContext('expiredcommenter');

  try {
    const expiredId = await createMessageForUser(
      author.user.id,
      'Mensaje vencido para comentar',
      25,
    );

    const expired = await commenter.context.post(`/api/messages/${expiredId}/comments`, {
      data: { text: 'Demasiado tarde' },
    });
    expect(expired.status()).toBe(410);
    expect((await expired.json()).code).toBe('message_gone');

    const missing = await commenter.context.post('/api/messages/999999999/comments', {
      data: { text: 'Fantasma' },
    });
    expect(missing.status()).toBe(410);

    const invalid = await commenter.context.post('/api/messages/abc/comments', {
      data: { text: 'Inválido' },
    });
    expect(invalid.status()).toBe(410);
  } finally {
    await author.context.dispose();
    await commenter.context.dispose();
  }
});

test('valida y modera el comentario', async () => {
  const author = await createSessionContext('validauthor');
  const commenter = await createSessionContext('validcommenter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje para validar comentarios' },
    });
    const messageBody = (await message.json()) as { id: number };

    for (const text of ['', '   ', 'a'.repeat(301)]) {
      const response = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
        data: { text },
      });
      expect(response.status()).toBe(422);
      expect((await response.json()).code).toBe('invalid_input');
    }

    const missing = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: {},
    });
    expect(missing.status()).toBe(422);

    const moderated = await commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
      data: { text: 'contenido_prohibido' },
    });
    expect(moderated.status()).toBe(422);
    expect((await moderated.json()).code).toBe('content_not_allowed');
  } finally {
    await author.context.dispose();
    await commenter.context.dispose();
  }
});

test('concurrencia: solo un comentario por usuario y mensaje', async () => {
  const author = await createSessionContext('raceauthor');
  const commenter = await createSessionContext('racecommenter');

  try {
    const message = await author.context.post('/api/messages', {
      data: { text: 'Mensaje para carrera de comentarios' },
    });
    const messageBody = (await message.json()) as { id: number };

    const [first, second] = await Promise.all([
      commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
        data: { text: 'Comentario concurrente uno' },
      }),
      commenter.context.post(`/api/messages/${messageBody.id}/comments`, {
        data: { text: 'Comentario concurrente dos' },
      }),
    ]);

    const statuses = [first.status(), second.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const conflict = first.status() === 409 ? first : second;
    expect((await conflict.json()).code).toBe('already_commented');

    const rows = await dbQuery<{ comments_count: number }>(
      'SELECT comments_count FROM messages WHERE id = $1',
      [messageBody.id],
    );
    expect(rows[0]?.comments_count).toBe(1);
  } finally {
    await author.context.dispose();
    await commenter.context.dispose();
  }
});
