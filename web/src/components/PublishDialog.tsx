import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, publishMessage } from '../api/client';
import { Dialog } from './Dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
  onRequireAuth: () => void;
};

function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Tu sesión expiró. Vuelve a entrar.';
    }
    if (error.status === 409 && error.code === 'already_has_active_message') {
      return 'Ya tienes un mensaje activo. Espera a que expire para publicar otro.';
    }
    if (error.status === 409 && error.code === 'duplicate_message') {
      return 'Ese texto ya está publicado por otra persona.';
    }
    if (error.status === 422) {
      return 'El mensaje debe tener entre 1 y 500 caracteres y pasar la moderación.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto antes de publicar.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    return error.message;
  }

  return 'No se pudo publicar el mensaje.';
}

export function PublishDialog({ open, onClose, onPublished, onRequireAuth }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setText('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const content = text.trim();
    if (content.length === 0) {
      setError('Escribe un mensaje antes de publicar.');
      return;
    }
    if (content.length > 500) {
      setError('El mensaje no puede superar los 500 caracteres.');
      return;
    }

    setSubmitting(true);

    try {
      await publishMessage(content);
      onPublished();
      onClose();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        onClose();
        onRequireAuth();
        return;
      }
      setError(publishErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Publicar mensaje"
      onClose={onClose}
      testId="publish-dialog"
      className="publish-dialog"
    >
      <form className="publish-dialog__form" onSubmit={handleSubmit} noValidate>
        <p className="publish-dialog__hint">
          Solo texto. El mensaje vivirá 24 horas y no se puede editar.
        </p>

        <label className="field" htmlFor="publish-text">
          <span className="field__label">Mensaje</span>
          <textarea
            id="publish-text"
            className="field__textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={5}
            data-testid="publish-text"
          />
        </label>

        <p
          className={`character-count${text.length >= 480 ? ' character-count--warning' : ''}`}
          aria-live="polite"
        >
          {text.length}/500
        </p>

        {error ? (
          <p className="field__error" role="alert" aria-live="polite" data-testid="publish-error">
            {error}
          </p>
        ) : null}

        <div className="dialog__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={submitting}
            data-testid="publish-submit"
          >
            {submitting ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
