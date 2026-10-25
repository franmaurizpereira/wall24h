type Props = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  return (
    <main className="state state--error" data-testid="wall-error" role="alert">
      <h2>No se pudo cargar el muro</h2>
      <p>{message}</p>
      <button type="button" className="button button--primary" onClick={onRetry}>
        Reintentar
      </button>
    </main>
  );
}
