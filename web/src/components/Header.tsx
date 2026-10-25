type Props = {
  onRefresh: () => void;
  loading: boolean;
};

export function Header({ onRefresh, loading }: Props) {
  return (
    <header className="app__header" data-testid="header">
      <div className="brand">
        <h1 className="brand__name">Ecco</h1>
        <p className="brand__tagline">Muro efímero · 24 horas</p>
      </div>
      <button type="button" className="button button--ghost" onClick={onRefresh} disabled={loading}>
        Actualizar
      </button>
    </header>
  );
}
