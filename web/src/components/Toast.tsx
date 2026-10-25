export type ToastMessage = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

type Props = {
  toast: ToastMessage | null;
  onClose: () => void;
};

export function Toast({ toast, onClose }: Props) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`toast toast--${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      data-testid="toast"
    >
      <p className="toast__message">{toast.message}</p>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Cerrar aviso">
        ×
      </button>
    </div>
  );
}
