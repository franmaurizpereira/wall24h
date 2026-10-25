import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, reportMessage } from '../api/client';
import { Dialog } from './Dialog';

export type ReportTarget = {
  id: number;
  content: string;
  author: string;
};

type Props = {
  message: ReportTarget | null;
  onClose: () => void;
  onReported: () => void;
  onRequireAuth: () => void;
};

function reportErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Tu sesión expiró. Vuelve a entrar.';
    }
    if (error.status === 403 && error.code === 'cannot_report_own_message') {
      return 'No puedes reportar tu propio mensaje.';
    }
    if (error.status === 409 && error.code === 'already_reported') {
      return 'Ya reportaste este mensaje.';
    }
    if (error.status === 410) {
      return 'Este mensaje ya expiró.';
    }
    if (error.status === 422) {
      return 'El motivo debe tener entre 5 y 500 caracteres y pasar la moderación.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto antes de reportar.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    return error.message;
  }

  return 'No se pudo enviar el reporte.';
}

export function ReportDialog({ message, onClose, onReported, onRequireAuth }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!message) {
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [message]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message) {
      return;
    }

    setError(null);
    const cleanReason = reason.trim();
    if (cleanReason.length < 5) {
      setError('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    if (cleanReason.length > 500) {
      setError('El motivo no puede superar los 500 caracteres.');
      return;
    }

    setSubmitting(true);

    try {
      await reportMessage(message.id, cleanReason);
      onReported();
      onClose();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        onClose();
        onRequireAuth();
        return;
      }
      setError(reportErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={message !== null}
      title="Reportar mensaje"
      onClose={onClose}
      testId="report-dialog"
      className="report-dialog"
    >
      {message ? (
        <form className="report-dialog__form" onSubmit={handleSubmit} noValidate>
          <p className="report-dialog__preview">
            <span className="report-dialog__author">@{message.author}</span>
            <span className="report-dialog__content">{message.content}</span>
          </p>

          <label className="field" htmlFor="report-reason">
            <span className="field__label">Motivo del reporte</span>
            <textarea
              id="report-reason"
              className="field__textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={4}
              data-testid="report-reason"
            />
            <span className="field__help">
              Explica brevemente el problema. El reporte queda en cola de moderación.
            </span>
          </label>

          {error ? (
            <p className="field__error" role="alert" aria-live="polite" data-testid="report-error">
              {error}
            </p>
          ) : null}

          <div className="dialog__actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button button--danger"
              disabled={submitting}
              data-testid="report-submit"
            >
              {submitting ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}
