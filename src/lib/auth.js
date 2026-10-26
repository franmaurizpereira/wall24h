import { httpError } from './errors.js';
import { SESSION_COOKIE, findSessionUser } from './sessions.js';

export function adminUsernames() {
  return (process.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUsername(username) {
  return adminUsernames().includes(String(username).toLowerCase());
}

export async function requireUser(request, reply) {
  const token = request.cookies[SESSION_COOKIE];
  const user = await findSessionUser(token);

  if (!user) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    throw httpError(401, 'not_authenticated', 'No autenticado');
  }

  request.user = user;
}

export async function requireAdmin(request, reply) {
  await requireUser(request, reply);

  if (!isAdminUsername(request.user.username)) {
    throw httpError(403, 'not_admin', 'No autorizado');
  }
}
