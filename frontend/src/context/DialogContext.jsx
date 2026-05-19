import { createContext, useCallback, useContext, useRef, useState } from 'react';

const DialogContext = createContext(null);

const initialDialog = {
  open: false,
  type: 'confirm',
  title: '',
  message: '',
  label: '',
  placeholder: '',
  defaultValue: '',
  inputType: 'text',
  required: false,
  confirmText: 'Xác nhận',
  cancelText: 'Hủy',
  tone: 'primary',
};

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState(initialDialog);
  const [value, setValue] = useState('');
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(initialDialog);
    setValue('');
  }, []);

  const openDialog = useCallback((options) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setValue(options.defaultValue || '');
    setDialog({
      ...initialDialog,
      ...options,
      open: true,
    });
  }), []);

  const confirm = useCallback((options) => openDialog({
    type: 'confirm',
    title: 'Xác nhận thao tác',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy',
    tone: 'danger',
    ...options,
  }), [openDialog]);

  const prompt = useCallback((options) => openDialog({
    type: 'prompt',
    title: 'Nhập thông tin',
    confirmText: 'Tiếp tục',
    cancelText: 'Hủy',
    required: true,
    ...options,
  }), [openDialog]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (dialog.type === 'prompt') {
      const trimmed = value.trim();
      if (dialog.required && !trimmed) return;
      close(trimmed);
      return;
    }
    close(true);
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog.open && (
        <div className="app-dialog-overlay animate-fadeIn" onClick={() => close(null)}>
          <form className="app-dialog animate-scaleIn" onSubmit={handleSubmit} onClick={event => event.stopPropagation()}>
            <div className="app-dialog__header">
              <h3>{dialog.title}</h3>
              <button type="button" className="app-dialog__close" onClick={() => close(null)} aria-label="Đóng">
                ×
              </button>
            </div>
            {dialog.message && <p className="app-dialog__message">{dialog.message}</p>}
            {dialog.type === 'prompt' && (
              <label className="app-dialog__field">
                {dialog.label && <span>{dialog.label}</span>}
                <input
                  className="form-input"
                  type={dialog.inputType}
                  value={value}
                  placeholder={dialog.placeholder}
                  autoFocus
                  onChange={event => setValue(event.target.value)}
                />
              </label>
            )}
            <div className="app-dialog__actions">
              <button type="button" className="btn btn-ghost" onClick={() => close(null)}>
                {dialog.cancelText}
              </button>
              <button type="submit" className={`btn ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}>
                {dialog.confirmText}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .app-dialog-overlay {
          position: fixed;
          inset: 0;
          z-index: var(--z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .46);
        }
        .app-dialog {
          width: min(440px, 100%);
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 22px;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-card);
          box-shadow: var(--shadow-xl);
        }
        .app-dialog__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .app-dialog__header h3 {
          color: var(--text-primary);
          font-size: 18px;
          font-weight: 800;
        }
        .app-dialog__close {
          width: 34px;
          height: 34px;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 20px;
          line-height: 1;
        }
        .app-dialog__close:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .app-dialog__message {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
        }
        .app-dialog__field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 700;
        }
        .app-dialog__actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 4px;
        }
      `}</style>
    </DialogContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog phải dùng bên trong DialogProvider');
  return ctx;
};
