import { expect, test } from '@playwright/test';
import {
  createAdminContext,
  createMessageForUser,
  createSessionContext,
  createUserDirect,
  truncateMessages,
} from '../helpers/api';

test.describe('moderación', () => {
  test.beforeEach(async () => {
    await truncateMessages();
  });

  test('lista reportes pendientes y los marca como revisados', async () => {
    const author = await createUserDirect('admin_author');
    const messageId = await createMessageForUser(author.id, 'Mensaje reportado para moderar');
    const reporter = await createSessionContext('admin_reporter');
    const report = await reporter.context.post(`/api/messages/${messageId}/report`, {
      data: { reason: 'Contenido ofensivo' },
    });
    expect(report.status()).toBe(201);

    const admin = await createAdminContext();
    const list = await admin.context.get('/api/admin/reports');
    expect(list.status()).toBe(200);
    const body = (await list.json()) as {
      items: Array<{ id: number; message_id: number; reason: string; status: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      message_id: messageId,
      reason: 'Contenido ofensivo',
      status: 'pending',
    });

    const reviewed = await admin.context.patch(`/api/admin/reports/${body.items[0].id}`, {
      data: { status: 'reviewed' },
    });
    expect(reviewed.status()).toBe(200);
    expect(await reviewed.json()).toMatchObject({ ok: true, status: 'reviewed' });

    const pending = await admin.context.get('/api/admin/reports?status=pending');
    expect(((await pending.json()) as { items: unknown[] }).items).toHaveLength(0);

    const all = await admin.context.get('/api/admin/reports?status=all');
    expect(((await all.json()) as { items: unknown[] }).items).toHaveLength(1);

    await reporter.context.dispose();
    await admin.context.dispose();
  });

  test('rechaza el panel a usuarios no administradores', async () => {
    const regular = await createSessionContext('admin_regular');
    const response = await regular.context.get('/api/admin/reports');

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('not_admin');
    await regular.context.dispose();
  });

  test('oculta un mensaje y bloquea detalle, comentarios y reportes', async () => {
    const author = await createUserDirect('hidden_author');
    const messageId = await createMessageForUser(author.id, 'Mensaje que será ocultado');

    const admin = await createAdminContext();
    const hidden = await admin.context.post(`/api/admin/messages/${messageId}/hide`);
    expect(hidden.status()).toBe(200);
    expect(await hidden.json()).toMatchObject({ ok: true });

    const wall = await admin.context.get('/api/wall');
    const wallBody = (await wall.json()) as { items: Array<{ id: number }> };
    expect(wallBody.items.some((item) => item.id === messageId)).toBe(false);

    const detail = await admin.context.get(`/api/messages/${messageId}`);
    expect(detail.status()).toBe(410);

    const other = await createSessionContext('hidden_other');
    const comment = await other.context.post(`/api/messages/${messageId}/comments`, {
      data: { text: 'Comentario tardío' },
    });
    expect(comment.status()).toBe(410);

    const report = await other.context.post(`/api/messages/${messageId}/report`, {
      data: { reason: 'Reporte tardío' },
    });
    expect(report.status()).toBe(410);

    const hiddenAgain = await admin.context.post(`/api/admin/messages/${messageId}/hide`);
    expect(hiddenAgain.status()).toBe(404);

    await other.context.dispose();
    await admin.context.dispose();
  });

  test('expone is_admin en /me y valida estados', async () => {
    const admin = await createAdminContext();
    const regular = await createSessionContext('admin_me');

    const adminMe = await admin.context.get('/api/auth/me');
    expect(await adminMe.json()).toMatchObject({ username: 'admin_test', is_admin: true });

    const regularMe = await regular.context.get('/api/auth/me');
    expect(await regularMe.json()).toMatchObject({ is_admin: false });

    const invalidList = await admin.context.get('/api/admin/reports?status=otro');
    expect(invalidList.status()).toBe(422);

    const invalidReview = await admin.context.patch('/api/admin/reports/1', {
      data: { status: 'pending' },
    });
    expect(invalidReview.status()).toBe(422);

    const missingReview = await admin.context.patch('/api/admin/reports/999999999', {
      data: { status: 'reviewed' },
    });
    expect(missingReview.status()).toBe(404);

    await regular.context.dispose();
    await admin.context.dispose();
  });
});
