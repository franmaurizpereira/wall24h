import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, type LoginData, type RegisterData, type User } from '../api/client';
import { Dialog } from './Dialog';

type Mode = 'login' | 'register';

type Props = {
  open: boolean;
  onClose: () => void;
  onLogin: (data: LoginData) => Promise<User>;
  onRegister: (data: RegisterData) => Promise<User>;
  onAuthenticated: (user: User) => void;
};

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Usuario o contraseña incorrectos.';
    }
    if (error.status === 409) {
      return 'Ese usuario o email ya existe.';
    }
    if (error.status === 422) {
      return 'Revisa los datos: usuario de 3–32 caracteres, email válido y contraseña de al menos 8.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto antes de volver a probar.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    return error.message;
  }

  return 'No se pudo completar la operación.';
}

export function AuthDialog({ open, onClose, onLogin, onRegister, onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('login');
      setUsername('');
      setEmail('');
      setPassword('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 32) {
      setError('El usuario debe tener entre 3 y 32 caracteres.');
      return;
    }

    if (password.length < (mode === 'register' ? 8 : 1)) {
      setError(
        mode === 'register'
          ? 'La contraseña debe tener al menos 8 caracteres.'
          : 'Escribe tu contraseña.',
      );
      return;
    }

    if (mode === 'register' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Escribe un email válido.');
      return;
    }

    setSubmitting(true);

    try {
      const user =
        mode === 'login'
          ? await onLogin({ username: cleanUsername, password })
          : await onRegister({
              username: cleanUsername,
              email: cleanEmail,
              password,
            });
      onAuthenticated(user);
      onClose();
    } catch (submitError) {
      setError(authErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Tu cuenta"
      onClose={onClose}
      testId="auth-dialog"
      className="auth-dialog"
    >
      <div className="auth-dialog__tabs" role="tablist" aria-label="Acceso">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`auth-dialog__tab${mode === 'login' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('login');
            setError(null);
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`auth-dialog__tab${mode === 'register' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('register');
            setError(null);
          }}
        >
          Crear cuenta
        </button>
      </div>

      <form className="auth-dialog__form" onSubmit={handleSubmit} noValidate>
        <label className="field" htmlFor="auth-username">
          <span className="field__label">Usuario</span>
          <input
            id="auth-username"
            className="field__input"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            data-testid="auth-username"
            autoFocus
          />
        </label>

        {mode === 'register' ? (
          <label className="field" htmlFor="auth-email">
            <span className="field__label">Email</span>
            <input
              id="auth-email"
              className="field__input"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="auth-email"
            />
          </label>
        ) : null}

        <label className="field" htmlFor="auth-password">
          <span className="field__label">Contraseña</span>
          <input
            id="auth-password"
            className="field__input"
            type="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            data-testid="auth-password"
          />
        </label>

        {error ? (
          <p className="field__error" role="alert" aria-live="polite" data-testid="auth-error">
            {error}
          </p>
        ) : null}

        <div className="dialog__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={submitting}
            data-testid="auth-submit"
          >
            {submitting ? 'Enviando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
