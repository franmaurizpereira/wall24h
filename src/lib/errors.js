export class ApiError extends Error {
  constructor(status, code, message = code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const httpError = (status, code, message = code, details) =>
  new ApiError(status, code, message, details);

export function mapDbError(error) {
  if (error?.code === '23P01') {
    if (error.constraint === 'uq_messages_active_per_user') {
      return httpError(409, 'already_has_active_message', 'Ya tienes un mensaje activo en el muro');
    }
    if (error.constraint === 'uq_messages_active_no_duplicates') {
      return httpError(409, 'duplicate_message', 'Ese mensaje ya está en el muro');
    }
  }

  if (error?.code === '23505') {
    if (error.constraint === 'uq_comments_one_per_user_message') {
      return httpError(409, 'already_commented', 'Ya comentaste este mensaje');
    }
    if (error.constraint === 'reports_one_per_user_message') {
      return httpError(409, 'already_reported', 'Ya reportaste este mensaje');
    }
    if (error.constraint === 'users_username_key' || error.constraint === 'users_email_key') {
      return httpError(409, 'already_exists', 'Usuario o email ya registrado');
    }
  }

  if (error?.code === 'P0001') {
    return httpError(403, 'cannot_comment_on_own_message', 'No puedes comentar tu propio mensaje');
  }
  if (error?.code === 'EC001') {
    return httpError(410, 'message_gone', 'Este mensaje ya expiró');
  }
  if (error?.code === 'EC002') {
    return httpError(403, 'cannot_report_own_message', 'No puedes reportar tu propio mensaje');
  }
  if (error?.code === 'EC003') {
    return httpError(409, 'message_immutable', 'El mensaje no se puede modificar');
  }
  if (error?.code === '23514') {
    return httpError(422, 'invalid_input', 'Datos inválidos');
  }

  return error;
}
