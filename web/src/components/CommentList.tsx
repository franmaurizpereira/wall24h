import type { Comment } from '../api/client';

type Props = {
  comments: Comment[];
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CommentList({ comments }: Props) {
  if (comments.length === 0) {
    return (
      <p className="comment-list__empty" data-testid="comments-empty">
        Todavía no hay comentarios.
      </p>
    );
  }

  return (
    <ul className="comment-list" data-testid="comment-list">
      {comments.map((comment) => (
        <li className="comment" key={comment.id} data-testid="comment">
          <p className="comment__content">{comment.content}</p>
          <footer className="comment__meta">
            <span className="comment__author">@{comment.author}</span>
            <time className="comment__date" dateTime={comment.created_at}>
              {formatDate(comment.created_at)}
            </time>
          </footer>
        </li>
      ))}
    </ul>
  );
}
