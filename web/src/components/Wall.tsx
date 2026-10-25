import type { WallResponse } from '../api/client';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { MessageCard } from './MessageCard';
import { TopMessage } from './TopMessage';

type Props = {
  data: WallResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onExpire?: () => void;
};

export function Wall({ data, loading, error, onRefresh, onExpire }: Props) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  if (!data || data.items.length === 0) {
    return <EmptyState />;
  }

  const top = data.items.find((item) => item.is_top);
  const rest = data.items.filter((item) => !item.is_top);

  return (
    <main className="wall" data-testid="wall">
      {top ? <TopMessage message={top} serverTime={data.server_time} onExpire={onExpire} /> : null}
      {rest.length > 0 ? (
        <section className="wall__grid" data-testid="wall-grid" aria-label="Resto de mensajes">
          {rest.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              serverTime={data.server_time}
              onExpire={onExpire}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
