import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import {
  LayoutDashboard, MapPin, Users, Shield, ClipboardList,
  BarChart3, Bell, LogOut, Menu, X, Sun, Moon, Wifi, WifiOff,
  Zap, Navigation, ChevronRight, Settings
} from 'lucide-react';

const adminNav = [
  { path: '/admin',               label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/live',          label: 'Live Map',      icon: MapPin },
  { path: '/admin/routes',        label: 'Routes',        icon: Navigation },
  { path: '/admin/employees',     label: 'Employees',     icon: Users },
  { path: '/admin/geofences',     label: 'Geo-Fences',   icon: Shield },
  { path: '/admin/tasks',         label: 'Tasks',         icon: ClipboardList },
  { path: '/admin/reports',       label: 'Reports',       icon: BarChart3 },
  { path: '/admin/notifications', label: 'Alerts',        icon: Bell,  badge: true },
];

const employeeNav = [
  { path: '/dashboard',     label: 'Home',          icon: LayoutDashboard },
  { path: '/tasks',         label: 'Tasks',         icon: ClipboardList },
  { path: '/routes',        label: 'Routes',        icon: Navigation },
  { path: '/notifications', label: 'Alerts',        icon: Bell, badge: true },
];

// Bottom bar shows first 4 items on mobile
const BOTTOM_BAR_COUNT = 4;

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { connected, notifications: socketNotifs, sosAlerts, dismissSOS } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('tf_theme') === 'dark');
  const [dbUnread, setDbUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        setDbUnread(res.data.count || 0);
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const socketUnread = socketNotifs.filter(n => !n.read).length;
  const unread = Math.max(dbUnread, socketUnread);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('tf_theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const nav = isAdmin ? adminNav : employeeNav;
  const bottomNav = nav.slice(0, BOTTOM_BAR_COUNT);
  const notifPath = isAdmin ? '/admin/notifications' : '/notifications';
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-[100dvh] bg-slate-100 dark:bg-slate-950 font-sans overflow-hidden">

      {/* ── SOS Emergency Overlay ─────────────────────────────── */}
      {sosAlerts.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full border-4 border-red-500 animate-pulse">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-3">🚨 SOS EMERGENCY</h2>
              {sosAlerts.map((a) => (
                <div key={a.employeeId} className="mb-3">
                  <p className="text-base font-semibold text-slate-800 dark:text-white">{a.name}</p>
                  <p className="text-slate-500 text-sm mt-1">{a.message}</p>
                  {a.location?.lat != null && (
                    <p className="text-xs text-slate-400 mt-1">
                      📍 {a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}
                    </p>
                  )}
                  <button
                    onClick={() => dismissSOS(a.employeeId)}
                    className="mt-4 w-full px-6 py-3 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-2xl font-semibold transition-all text-sm"
                  >
                    Acknowledge Alert
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Sidebar Backdrop ────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Desktop Sidebar ────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-slate-900 dark:bg-slate-950 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">TrackFlow</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="px-4 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-2xl px-3 py-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role}</p>
            </div>
            <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ path, label, icon: Icon, badge }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  {badge && unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="flex-1">{label}</span>
                {badge && unread > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-slate-800 space-y-0.5 shrink-0">
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white w-full transition-all"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top Header */}
        <header className="h-14 lg:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
          {/* Left: Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Center: Page title on mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-slate-900 dark:text-white text-base tracking-tight">TrackFlow</span>
          </div>
          <div className="hidden lg:block" />

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Connectivity pill */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              connected
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'Live' : 'Offline'}
            </div>

            {/* Connection dot – mobile only */}
            <div className={`sm:hidden w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />

            {/* Theme toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications bell */}
            <Link
              to={notifPath}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            {/* User avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md cursor-default select-none">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content – leaves room for mobile bottom nav */}
        <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 pb-[72px] lg:pb-0">
          {children}
        </main>

        {/* ── Mobile Bottom Navigation Bar ──────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
          <div className="flex items-stretch h-[62px]">
            {bottomNav.map(({ path, label, icon: Icon, badge }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all relative ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                  <span className={`relative w-10 h-8 flex items-center justify-center rounded-xl transition-all ${
                    active ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}>
                    <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : 'scale-100'}`} />
                    {badge && unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  <span className="leading-none">{label}</span>
                </Link>
              );
            })}
            {/* More button → opens sidebar */}
            {nav.length > BOTTOM_BAR_COUNT && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-all"
              >
                <span className="w-10 h-8 flex items-center justify-center rounded-xl">
                  <Menu className="w-5 h-5" />
                </span>
                <span className="leading-none">More</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
