import type { MouseEvent } from 'react';
import type { WallItem } from '../api/client';
import { formatComments } from '../lib/format';
import { Countdown } from './Countdown';

type Props = {
  message: WallItem;
  serverTime: string;
  onOpen: (id: number) => void;
  onReport: (message: WallItem) => void;
  onExpire?: () => void;
};

export function TopMessage({ message, serverTime, onOpen, onReport, onExpire }: Props) {
  function handleOpen(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onOpen(message.id);
  }

  return (
    <article className="message-card message-card--top" data-testid="top-message">
      <span className="badge badge--top">Más comentado</span>
      <p className="message-card__content">
        <a
          className="message-card__link"
          href={`/messages/${message.id}`}
          onClick={handleOpen}
          data-testid="message-link"
        >
          {message.content}
        </a>
      </p>
      <footer className="message-card__meta">
        <span className="message-card__author">@{message.author}</span>
        <span className="message-card__comments" aria-live="polite" data-testid="comment-count">
          {formatComments(message.comments_count)}
        </span>
        <Countdown expiresAt={message.expires_at} serverTime={serverTime} onExpire={onExpire} />
      </footer>
      <div className="message-card__actions">
        <a
          className="button button--primary button--small"
          href={`/messages/${message.id}`}
          onClick={handleOpen}
          data-testid="comment-link"
        >
          Comentar
        </a>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => onReport(message)}
          aria-label={`Reportar mensaje de @${message.author}`}
          data-testid="report-button"
        >
          Reportar
        </button>
      </div>
    </article>
  );
}
