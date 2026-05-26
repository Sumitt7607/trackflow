import { useEffect, useState, useCallback } from 'react';
import { X, Zap, AlertTriangle, CheckCircle2, Info, Navigation } from 'lucide-react';

const ICONS = {
  sos:       { icon: Zap,           bg: 'bg-red-500',    text: 'text-white', border: 'border-red-400' },
  violation: { icon: AlertTriangle,  bg: 'bg-amber-500',  text: 'text-white', border: 'border-amber-400' },
  task:      { icon: CheckCircle2,   bg: 'bg-blue-500',   text: 'text-white', border: 'border-blue-400' },
  route:     { icon: Navigation,     bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-400' },
  general:   { icon: Info,           bg: 'bg-slate-600',  text: 'text-white', border: 'border-slate-500' },
};

function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 5s (sos stays 10s)
    const timeout = toast.type === 'sos' ? 10000 : 5000;
    const timer = setTimeout(() => dismiss(), timeout);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 350);
  };

  const cfg = ICONS[toast.type] || ICONS.general;
  const Icon = cfg.icon;

  return (
    <div
      className={`
        flex items-start gap-3 w-80 p-4 rounded-2xl shadow-2xl border
        bg-white dark:bg-slate-900 ${cfg.border}
        transform transition-all duration-350 ease-out
        ${visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
          {toast.type === 'sos' ? '🚨 SOS Emergency' :
           toast.type === 'violation' ? '⚠️ Geo-Fence Alert' :
           toast.type === 'task' ? '📋 Task Update' :
           toast.type === 'route' ? '🗺️ Route Alert' : 'ℹ️ Notification'}
        </p>
        <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug line-clamp-2">
          {toast.message}
        </p>
        {toast.timestamp && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {new Date(toast.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress bar */}
      {toast.type !== 'sos' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${cfg.bg} opacity-70`}
            style={{
              animation: `shrink ${toast.type === 'sos' ? 10 : 5}s linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
      `}</style>
      <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto relative">
            <Toast toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
