import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  Bell, CheckCheck, Trash2, AlertTriangle, Zap,
  ClipboardList, Info, RefreshCw, Filter, BellOff,
  MapPin, Clock, ChevronRight
} from 'lucide-react';

const TYPE_CFG = {
  sos: {
    label: 'SOS Emergency',
    icon: Zap,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-l-4 border-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  },
  violation: {
    label: 'Geo-Fence Alert',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-l-4 border-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  task: {
    label: 'Task Update',
    icon: ClipboardList,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-l-4 border-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  },
  general: {
    label: 'General',
    icon: Info,
    color: 'text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-l-4 border-slate-300 dark:border-slate-600',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | sos | violation | task | general
  const [clearing, setClearing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const clearRead = async () => {
    setClearing(true);
    try {
      await api.delete('/notifications/clear-read');
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (err) {
      console.error('Failed to clear read', err);
    } finally {
      setClearing(false);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: `Unread (${unreadCount})` },
    { key: 'sos', label: '🚨 SOS' },
    { key: 'violation', label: '⚠️ Geo-Fence' },
    { key: 'task', label: '📋 Tasks' },
    { key: 'general', label: 'ℹ️ General' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-500" />
            Notifications
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
          )}
          <button
            onClick={clearRead}
            disabled={clearing || notifications.filter(n => n.read).length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear Read
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: notifications.length, color: 'from-brand-500 to-purple-600' },
          { label: 'Unread', value: unreadCount, color: 'from-amber-500 to-orange-500' },
          { label: 'SOS', value: notifications.filter(n => n.type === 'sos').length, color: 'from-red-500 to-rose-600' },
          { label: 'Violations', value: notifications.filter(n => n.type === 'violation').length, color: 'from-amber-500 to-yellow-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              filter === key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <BellOff className="w-14 h-14 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="font-semibold text-slate-500">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {filter === 'unread' ? "You're all caught up!" : 'New alerts will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((notif) => {
              const cfg = TYPE_CFG[notif.type] || TYPE_CFG.general;
              const Icon = cfg.icon;
              return (
                <div
                  key={notif._id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${cfg.border} ${
                    !notif.read ? cfg.bg : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'sos' ? 'bg-red-100 dark:bg-red-900/30' :
                    notif.type === 'violation' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    notif.type === 'task' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          {!notif.read && (
                            <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className={`text-sm font-medium mt-1 ${
                          notif.read
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            {timeAgo(notif.createdAt)}
                          </span>
                          {notif.sender?.name && (
                            <span className="text-[11px] text-slate-400">
                              from <span className="font-semibold text-slate-600 dark:text-slate-300">{notif.sender.name}</span>
                            </span>
                          )}
                          {notif.metadata?.lat && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="w-3 h-3" />
                              {notif.metadata.lat.toFixed(4)}, {notif.metadata.lng?.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif._id)}
                        title="Mark as read"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotif(notif._id)}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
