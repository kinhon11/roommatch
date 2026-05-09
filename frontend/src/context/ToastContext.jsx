import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;
const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
const COLORS = {
  success: { bg: 'rgba(16,185,129,.12)', border: 'rgba(16,185,129,.3)', text: '#6ee7b7' },
  error:   { bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.3)',  text: '#fca5a5' },
  warning: { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)', text: '#fcd34d' },
  info:    { bg: 'rgba(99,102,241,.12)', border: 'rgba(99,102,241,.3)', text: '#a5b4fc' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, d) => addToast(msg, 'success', d),
    error:   (msg, d) => addToast(msg, 'error',   d),
    warning: (msg, d) => addToast(msg, 'warning', d),
    info:    (msg, d) => addToast(msg, 'info',    d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        maxWidth: 360, pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px',
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                color: c.text,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.5,
                pointerEvents: 'all',
                boxShadow: '0 8px 32px rgba(0,0,0,.4)',
                animation: 'toastSlideIn .3s ease both',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: c.text, opacity: .7, fontSize: 16, padding: 0,
                  flexShrink: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(.95); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải dùng bên trong ToastProvider');
  return ctx;
};
