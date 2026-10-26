import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  getAdminReports,
  hideAdminMessage,
  reviewAdminReport,
  type AdminReport,
} from '../api/client';
import type { ToastMessage } from './Toast';

type Props = {
  onBack: () => void;
  onMessageHidden: () => void;
  onToast: (kind: ToastMessage['kind'], message: string) => void;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminPanel({ onBack, onMessageHidden, onToast }: Props) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminReports('pending');
      setReports(data.items);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 403) {
        setError('No tienes permisos para ver la moderación.');
      } else {
        setError(
          loadError instanceof Error ? loadError.message : 'No se pudieron cargar los reportes.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReview(report: AdminReport, status: 'reviewed' | 'actioned') {
    setBusyId(report.id);
    setError(null);
    try {
      await reviewAdminReport(report.id, status);
      setReports((current) => current.filter((item) => item.id !== report.id));
      onToast(
        'success',
        status === 'reviewed'
          ? 'Reporte marcado como revisado.'
          : 'Reporte marcado como accionado.',
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error ? reviewError.message : 'No se pudo actualizar el reporte.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleHide(report: AdminReport) {
    if (!window.confirm('¿Ocultar este mensaje del muro? Se conservará para auditoría.')) {
      return;
    }

    setBusyId(report.id);
    setError(null);
    try {
      await hideAdminMessage(report.message_id);
      setReports((current) =>
        current.map((item) =>
          item.message_id === report.message_id ? { ...item, message_hidden: true } : item,
        ),
      );
      onMessageHidden();
      onToast('success', 'Mensaje oculto del muro.');
    } catch (hideError) {
      setError(hideError instanceof Error ? hideError.message : 'No se pudo ocultar el mensaje.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="wall" data-testid="admin-panel">
      <button type="button" className="link-button message-detail__back" onClick={onBack}>
        ← Volver al muro
      </button>

      <section className="comment-section" aria-labelledby="admin-title">
        <h1 id="admin-title" className="comment-section__title">
          Moderación
        </h1>
        <p className="publish-dialog__hint">
          Reportes pendientes. Ocultar un mensaje lo retira del muro sin borrar la evidencia.
        </p>
      </section>

      {error ? (
        <p className="field__error" role="alert" data-testid="admin-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="comment-form__note" data-testid="admin-loading">
          Cargando reportes…
        </p>
      ) : null}

      {!loading && reports.length === 0 && !error ? (
        <p className="comment-form__note" data-testid="admin-empty">
          No hay reportes pendientes.
        </p>
      ) : null}

      {reports.length > 0 ? (
        <section
          className="wall__grid"
          data-testid="admin-reports"
          aria-label="Reportes pendientes"
        >
          {reports.map((report) => (
            <article className="message-card" key={report.id} data-testid="admin-report">
              <span className="badge badge--top">
                {report.message_hidden ? 'Mensaje oculto' : 'Reporte pendiente'}
              </span>
              <p className="message-card__content">{report.message_content}</p>
              <footer className="message-card__meta">
                <span className="message-card__author">@{report.message_author}</span>
                <time className="comment__date" dateTime={report.created_at}>
                  {formatDate(report.created_at)}
                </time>
              </footer>
              <p className="comment-form__note">
                <strong>Motivo:</strong> {report.reason}
              </p>
              <div className="message-card__actions">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => void handleReview(report, 'reviewed')}
                  disabled={busyId === report.id}
                  data-testid="admin-review"
                >
                  Revisado
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => void handleReview(report, 'actioned')}
                  disabled={busyId === report.id}
                  data-testid="admin-action"
                >
                  Accionado
                </button>
                <button
                  type="button"
                  className="button button--danger button--small"
                  onClick={() => void handleHide(report)}
                  disabled={busyId === report.id || report.message_hidden}
                  data-testid="admin-hide"
                >
                  {report.message_hidden ? 'Oculto' : 'Ocultar'}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
