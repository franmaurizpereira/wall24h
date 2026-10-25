import type { WallItem, WallResponse } from '../api/client';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { MessageCard } from './MessageCard';
import { TopMessage } from './TopMessage';

type Props = {
  data: WallResponse | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  onRefresh: () => void;
  onOpen: (id: number) => void;
  onReport: (message: WallItem) => void;
  onExpire?: () => void;
};

function StaleNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="wall__stale" role="status" data-testid="wall-stale">
      <p>No se pudo actualizar. Mostrando los últimos datos.</p>
      <button type="button" className="button button--ghost button--small" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

export function Wall({
  data,
  loading,
  error,
  stale,
  onRefresh,
  onOpen,
  onReport,
  onExpire,
}: Props) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  if (!data || data.items.length === 0) {
    return (
      <>
        {stale ? <StaleNotice onRetry={onRefresh} /> : null}
        <EmptyState />
      </>
    );
  }

  const top = data.items.find((item) => item.is_top);
  const rest = data.items.filter((item) => !item.is_top);

  return (
    <main className="wall" data-testid="wall">
      {stale ? <StaleNotice onRetry={onRefresh} /> : null}
      {top ? (
        <TopMessage
          message={top}
          serverTime={data.server_time}
          onOpen={onOpen}
          onReport={onReport}
          onExpire={onExpire}
        />
      ) : null}
      {rest.length > 0 ? (
        <section className="wall__grid" data-testid="wall-grid" aria-label="Resto de mensajes">
          {rest.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              serverTime={data.server_time}
              onOpen={onOpen}
              onReport={onReport}
              onExpire={onExpire}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
