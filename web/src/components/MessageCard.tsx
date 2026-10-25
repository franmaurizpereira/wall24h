import type { WallItem } from '../api/client';
import { formatComments } from '../lib/format';
import { Countdown } from './Countdown';

type Props = {
  message: WallItem;
  serverTime: string;
  onExpire?: () => void;
};

export function MessageCard({ message, serverTime, onExpire }: Props) {
  return (
    <article className="message-card" data-testid="message-card">
      <p className="message-card__content">{message.content}</p>
      <footer className="message-card__meta">
        <span className="message-card__author">@{message.author}</span>
        <span className="message-card__comments" data-testid="comment-count">
          {formatComments(message.comments_count)}
        </span>
        <Countdown expiresAt={message.expires_at} serverTime={serverTime} onExpire={onExpire} />
      </footer>
    </article>
  );
}
