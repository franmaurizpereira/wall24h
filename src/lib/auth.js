import { httpError } from './errors.js';
import { SESSION_COOKIE, findSessionUser } from './sessions.js';

export async function requireUser(request, reply) {
  const token = request.cookies[SESSION_COOKIE];
  const user = await findSessionUser(token);

  if (!user) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    throw httpError(401, 'not_authenticated', 'No autenticado');
  }

  request.user = user;
}
