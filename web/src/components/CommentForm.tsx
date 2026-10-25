import { useState, type FormEvent } from 'react';
import { ApiError, createComment, type MessageDetail, type User } from '../api/client';

type Props = {
  message: MessageDetail;
  user: User | null;
  sessionLoading: boolean;
  onRequireAuth: () => void;
  onSubmitted: () => void | Promise<void>;
};

function commentErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Tu sesión expiró. Vuelve a entrar.';
    }
    if (error.status === 403 && error.code === 'cannot_comment_on_own_message') {
      return 'No puedes comentar tu propio mensaje.';
    }
    if (error.status === 409 && error.code === 'already_commented') {
      return 'Ya comentaste este mensaje.';
    }
    if (error.status === 410) {
      return 'Este mensaje ya expiró.';
    }
    if (error.status === 422) {
      return 'El comentario debe tener entre 1 y 300 caracteres y pasar la moderación.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto antes de comentar.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    return error.message;
  }

  return 'No se pudo publicar el comentario.';
}

export function CommentForm({ message, user, sessionLoading, onRequireAuth, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (sessionLoading) {
    return (
      <p className="comment-form__note" data-testid="comment-session-loading">
        Comprobando sesión…
      </p>
    );
  }

  if (!user) {
    return (
      <div className="comment-form comment-form--guest" data-testid="comment-auth">
        <p className="comment-form__note">Entra para comentar este mensaje.</p>
        <button type="button" className="button button--primary" onClick={onRequireAuth}>
          Entrar para comentar
        </button>
      </div>
    );
  }

  const username = user.username.toLowerCase();

  if (message.author.toLowerCase() === username) {
    return (
      <p className="comment-form__note" data-testid="comment-own">
        No puedes comentar tu propio mensaje.
      </p>
    );
  }

  if (message.comments.some((comment) => comment.author.toLowerCase() === username)) {
    return (
      <p className="comment-form__note" data-testid="comment-already">
        Ya comentaste este mensaje.
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const content = text.trim();
    if (content.length === 0) {
      setError('Escribe un comentario antes de enviarlo.');
      return;
    }
    if (content.length > 300) {
      setError('El comentario no puede superar los 300 caracteres.');
      return;
    }

    setSubmitting(true);

    try {
      await createComment(message.id, content);
      setText('');
      await onSubmitted();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        onRequireAuth();
      }
      setError(commentErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit} noValidate data-testid="comment-form">
      <label className="field" htmlFor="comment-text">
        <span className="field__label">Tu comentario</span>
        <textarea
          id="comment-text"
          className="field__textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={300}
          rows={3}
          data-testid="comment-text"
        />
      </label>

      <p
        className={`character-count${text.length >= 280 ? ' character-count--warning' : ''}`}
        aria-live="polite"
      >
        {text.length}/300
      </p>

      {error ? (
        <p className="field__error" role="alert" aria-live="polite" data-testid="comment-error">
          {error}
        </p>
      ) : null}

      <div className="comment-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting}
          data-testid="comment-submit"
        >
          {submitting ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </form>
  );
}
