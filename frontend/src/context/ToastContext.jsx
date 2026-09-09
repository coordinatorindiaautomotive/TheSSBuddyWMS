import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Fixed Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          let bg = 'bg-white border-slate-200 text-slate-800';
          let Icon = Info;
          let iconColor = 'text-blue-600 bg-blue-50';

          if (t.type === 'success') {
            bg = 'bg-emerald-50/95 border-emerald-300 text-emerald-950';
            Icon = CheckCircle2;
            iconColor = 'text-emerald-600 bg-emerald-100';
          } else if (t.type === 'error') {
            bg = 'bg-red-50/95 border-red-300 text-red-950';
            Icon = XCircle;
            iconColor = 'text-red-600 bg-red-100';
          } else if (t.type === 'warning') {
            bg = 'bg-amber-50/95 border-amber-300 text-amber-950';
            Icon = AlertTriangle;
            iconColor = 'text-amber-600 bg-amber-100';
          } else if (t.type === 'info') {
            bg = 'bg-blue-50/95 border-blue-300 text-blue-950';
            Icon = Info;
            iconColor = 'text-[#004C8F] bg-blue-100';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-xs transition-all duration-300 ${bg}`}
              role="alert"
            >
              <div className={`p-1 rounded-lg shrink-0 ${iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs font-semibold leading-relaxed pt-0.5">
                {t.message}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
