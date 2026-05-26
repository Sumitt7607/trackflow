import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Zap } from 'lucide-react';

export default function SOSButton({ lat, lng }) {
  const { sendSOS } = useSocket();
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);

  const handlePress = () => {
    if (!confirm) { setConfirm(true); return; }
    sendSOS(lat, lng);
    setSent(true);
    setConfirm(false);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {confirm && !sent && (
        <p className="text-sm font-semibold text-red-500 animate-pulse">
          Tap again to confirm SOS!
        </p>
      )}
      {sent && (
        <p className="text-sm font-semibold text-emerald-500">✓ SOS Alert Sent to Admin!</p>
      )}
      <button
        onBlur={() => setConfirm(false)}
        onClick={handlePress}
        className={`
          relative w-24 h-24 rounded-full font-bold text-white text-sm uppercase tracking-widest
          flex flex-col items-center justify-center gap-1
          shadow-2xl transition-all duration-200 active:scale-95
          ${sent
            ? 'bg-emerald-500 shadow-emerald-500/50'
            : confirm
            ? 'bg-red-700 shadow-red-700/70 scale-110 animate-pulse'
            : 'bg-gradient-to-br from-red-500 to-rose-700 shadow-red-500/50 hover:scale-105'
          }
        `}
      >
        <Zap className="w-8 h-8" />
        <span className="text-[10px] font-extrabold">{sent ? 'SENT' : 'SOS'}</span>
        {/* Ripple rings */}
        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />
        <span className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
      </button>
      {confirm && (
        <button onClick={() => setConfirm(false)} className="text-xs text-slate-400 underline">
          Cancel
        </button>
      )}
    </div>
  );
}
