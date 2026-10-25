import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId: string;
  className?: string;
};

export function Dialog({ open, title, onClose, children, testId, className = '' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${className}`.trim()}
      aria-labelledby={titleId}
      aria-modal="true"
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dialog__panel">
        <header className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
