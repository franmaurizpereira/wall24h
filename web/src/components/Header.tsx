import type { User } from '../api/client';

type Props = {
  user: User | null;
  sessionLoading: boolean;
  loading: boolean;
  onOpenAuth: () => void;
  onPublish: () => void;
  onLogout: () => void;
  onRefresh: () => void;
};

export function Header({
  user,
  sessionLoading,
  loading,
  onOpenAuth,
  onPublish,
  onLogout,
  onRefresh,
}: Props) {
  return (
    <header className="app__header" data-testid="header">
      <div className="brand">
        <h1 className="brand__name">Ecco</h1>
        <p className="brand__tagline">Muro efímero · 24 horas</p>
      </div>

      <div className="header__actions">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={onRefresh}
          disabled={loading}
        >
          Actualizar
        </button>
        <button
          type="button"
          className="button button--primary button--small"
          onClick={onPublish}
          data-testid="open-publish"
        >
          Publicar
        </button>

        {sessionLoading ? (
          <span className="session__loading" data-testid="session-loading">
            …
          </span>
        ) : user ? (
          <div className="session">
            <span className="session__user" data-testid="session-user">
              @{user.username}
            </span>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onLogout}
              data-testid="logout"
            >
              Salir
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={onOpenAuth}
            data-testid="open-auth"
          >
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
