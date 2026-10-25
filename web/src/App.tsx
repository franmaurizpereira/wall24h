import { useCallback, useEffect, useState } from 'react';
import type { User } from './api/client';
import { AuthDialog } from './components/AuthDialog';
import { Header } from './components/Header';
import { MessageDetail } from './components/MessageDetail';
import { PublishDialog } from './components/PublishDialog';
import { ReportDialog, type ReportTarget } from './components/ReportDialog';
import { Toast, type ToastMessage } from './components/Toast';
import { Wall } from './components/Wall';
import { useRoute } from './hooks/useRoute';
import { useSession } from './hooks/useSession';
import { useWall } from './hooks/useWall';

export function App() {
  const { user, loading: sessionLoading, login, register, logout } = useSession();
  const { data, loading, error, stale, refresh } = useWall();
  const { messageId, navigate } = useRoute();

  const [authOpen, setAuthOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((kind: ToastMessage['kind'], message: string) => {
    setToast({ kind, message });
  }, []);

  const requireAuth = useCallback(() => {
    setAuthOpen(true);
  }, []);

  const handleAuthenticated = useCallback(
    (authenticatedUser: User) => {
      showToast('success', `Hola, @${authenticatedUser.username}`);
    },
    [showToast],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      showToast('info', 'Sesión cerrada');
      void refresh();
    } catch {
      showToast('error', 'No se pudo cerrar la sesión');
    }
  }, [logout, refresh, showToast]);

  const handlePublished = useCallback(() => {
    showToast('success', 'Mensaje publicado. Vivirá 24 horas.');
    navigate('/');
    void refresh();
  }, [navigate, refresh, showToast]);

  const handleOpen = useCallback(
    (id: number) => {
      navigate(`/messages/${id}`);
    },
    [navigate],
  );

  const handleReport = useCallback(
    (message: ReportTarget) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      setReportTarget(message);
    },
    [user],
  );

  const handleCommentCreated = useCallback(() => {
    showToast('success', 'Comentario publicado.');
    void refresh();
  }, [refresh, showToast]);

  const handleExpired = useCallback(() => {
    showToast('error', 'Este mensaje ya expiró.');
    navigate('/');
    void refresh();
  }, [navigate, refresh, showToast]);

  const serverTime = data?.server_time ?? new Date().toISOString();

  return (
    <div className="app" data-testid="app">
      <Header
        user={user}
        sessionLoading={sessionLoading}
        loading={loading}
        onOpenAuth={() => setAuthOpen(true)}
        onPublish={() => (user ? setPublishOpen(true) : setAuthOpen(true))}
        onLogout={() => void handleLogout()}
        onRefresh={() => void refresh()}
      />

      {messageId === null ? (
        <Wall
          data={data}
          loading={loading}
          error={error}
          stale={stale}
          onRefresh={() => void refresh()}
          onOpen={handleOpen}
          onReport={handleReport}
          onExpire={() => void refresh()}
        />
      ) : (
        <MessageDetail
          messageId={messageId}
          serverTime={serverTime}
          user={user}
          sessionLoading={sessionLoading}
          onBack={() => navigate('/')}
          onRequireAuth={requireAuth}
          onReport={handleReport}
          onCommentCreated={handleCommentCreated}
          onExpired={handleExpired}
        />
      )}

      <footer className="app__footer">
        <p>Cada mensaje vive 24 horas.</p>
      </footer>

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={login}
        onRegister={register}
        onAuthenticated={handleAuthenticated}
      />

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublished={handlePublished}
        onRequireAuth={() => {
          setPublishOpen(false);
          setAuthOpen(true);
        }}
      />

      <ReportDialog
        message={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={() => showToast('success', 'Reporte enviado a moderación.')}
        onRequireAuth={() => {
          setReportTarget(null);
          setAuthOpen(true);
        }}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
