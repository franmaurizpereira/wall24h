import type { MessageDetail as MessageDetailData, User } from '../api/client';
import { formatComments } from '../lib/format';
import { useMessage } from '../hooks/useMessage';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';
import { Countdown } from './Countdown';

type ReportableMessage = {
  id: number;
  content: string;
  author: string;
};

type Props = {
  messageId: number;
  serverTime: string;
  user: User | null;
  sessionLoading: boolean;
  onBack: () => void;
  onRequireAuth: () => void;
  onReport: (message: ReportableMessage) => void;
  onCommentCreated: () => void;
  onExpired: () => void;
};

export function MessageDetail({
  messageId,
  serverTime,
  user,
  sessionLoading,
  onBack,
  onRequireAuth,
  onReport,
  onCommentCreated,
  onExpired,
}: Props) {
  const { data, loading, error, refresh } = useMessage(messageId);

  if (loading) {
    return (
      <main className="state state--loading" data-testid="detail-loading" aria-busy="true">
        <p>Cargando el mensaje…</p>
      </main>
    );
  }

  if (error || !data) {
    const expired = error?.status === 410;
    return (
      <main className="state state--error" data-testid="detail-error" role="alert">
        <h2>{expired ? 'Este mensaje ya expiró' : 'No se pudo cargar el mensaje'}</h2>
        <p>{expired ? 'Los mensajes viven 24 horas.' : (error?.message ?? 'Error inesperado')}</p>
        <div className="state__actions">
          <button type="button" className="button button--primary" onClick={onBack}>
            Volver al muro
          </button>
          {!expired ? (
            <button type="button" className="button button--ghost" onClick={() => void refresh()}>
              Reintentar
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  const message: MessageDetailData = data;

  async function handleCommentSubmitted() {
    await refresh();
    onCommentCreated();
  }

  return (
    <main className="message-detail" data-testid="message-detail">
      <button
        type="button"
        className="link-button message-detail__back"
        onClick={onBack}
        data-testid="detail-back"
      >
        ← Volver al muro
      </button>

      <article className="message-card message-card--detail">
        <p className="message-card__content">{message.content}</p>
        <footer className="message-card__meta">
          <span className="message-card__author">@{message.author}</span>
          <span
            className="message-card__comments"
            aria-live="polite"
            data-testid="detail-comments-count"
          >
            {formatComments(message.comments_count)}
          </span>
          <Countdown expiresAt={message.expires_at} serverTime={serverTime} onExpire={onExpired} />
        </footer>
        <div className="message-detail__actions">
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => onReport(message)}
            data-testid="detail-report"
          >
            Reportar
          </button>
        </div>
      </article>

      <section className="comment-section" aria-labelledby="comments-title">
        <h2 id="comments-title" className="comment-section__title">
          Comentarios
        </h2>
        <CommentList comments={message.comments} />
      </section>

      <section className="comment-section" aria-labelledby="comment-form-title">
        <h2 id="comment-form-title" className="comment-section__title">
          Deja tu comentario
        </h2>
        <CommentForm
          message={message}
          user={user}
          sessionLoading={sessionLoading}
          onRequireAuth={onRequireAuth}
          onSubmitted={handleCommentSubmitted}
        />
      </section>
    </main>
  );
}
