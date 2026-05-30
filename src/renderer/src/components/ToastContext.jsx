import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const TOAST_CFG = {
  success: { icon: CheckCircle2, iconBg: 'bg-emerald-100', iconFg: 'text-emerald-600' },
  error:   { icon: XCircle,       iconBg: 'bg-red-100',    iconFg: 'text-red-600' },
  warning: { icon: AlertTriangle, iconBg: 'bg-amber-100',  iconFg: 'text-amber-600' },
  info:    { icon: Info,          iconBg: 'bg-blue-100',   iconFg: 'text-blue-600' },
};

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const duration = toast.duration || 3000;
  const cfg = TOAST_CFG[toast.type] || TOAST_CFG.info;
  const Icon = cfg.icon;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dismiss, duration]);

  const pause = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const resume = () => {
    timerRef.current = setTimeout(dismiss, duration);
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 transition-all duration-300"
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(40px)' : 'translateX(0)',
        maxWidth: 380,
      }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className={`w-8 h-8 rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={cfg.iconFg} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-slate-800 font-semibold text-sm">{toast.title}</div>
        {toast.message && <div className="text-slate-500 text-xs mt-0.5 truncate">{toast.message}</div>}
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-1 rounded-full hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, message, duration) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[99999] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
