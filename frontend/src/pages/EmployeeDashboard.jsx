import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import SOSButton from '../components/SOSButton';
import MapView from '../components/Map';
import {
  MapPin, Battery, Wifi, Navigation, Clock, CalendarCheck,
  CheckCircle2, AlertCircle, ClipboardList, TrendingUp,
  Activity, Calendar, Target, ArrowRight, WifiOff,
  LogIn, LogOut, RefreshCw, ChevronRight
} from 'lucide-react';
import {
  saveOfflineLocation, getOfflineLocations, clearOfflineLocations,
  saveOfflineAttendance, getOfflineAttendance, clearOfflineAttendance,
  saveOfflineTask, getOfflineTasks, clearOfflineTasks
} from '../utils/db';

const STATUS_CFG = {
  pending:      { label: 'Pending',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     dot: 'bg-amber-500',     icon: Clock },
  'in-progress':{ label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         dot: 'bg-blue-500',      icon: Activity },
  completed:    { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2 },
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { connected, sendLocationUpdate } = useSocket();

  const [isOnDuty, setIsOnDuty] = useState(false);
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [battery, setBattery] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [tasks, setTasks] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [taskFilter, setTaskFilter] = useState('all');

  const timerRef = useRef(null);

  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((batt) => {
        setBattery(Math.round(batt.level * 100));
        batt.addEventListener('levelchange', () => setBattery(Math.round(batt.level * 100)));
      });
    }
  }, []);

  const getOfflinePendingCount = async () => {
    try {
      const [locs, atts, tsks] = await Promise.all([getOfflineLocations(), getOfflineAttendance(), getOfflineTasks()]);
      return (locs?.length || 0) + (atts?.length || 0) + (tsks?.length || 0);
    } catch (_) { return 0; }
  };

  const updateOfflineCount = async () => {
    const count = await getOfflinePendingCount();
    setOfflineCount(count);
  };

  useEffect(() => {
    updateOfflineCount();
    const interval = setInterval(updateOfflineCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Offline sync on reconnect
  useEffect(() => {
    const syncOfflineData = async () => {
      if (connected && !syncing) {
        setSyncing(true);
        try {
          const [locs, atts, tsks] = await Promise.all([getOfflineLocations(), getOfflineAttendance(), getOfflineTasks()]);
          const total = (locs?.length || 0) + (atts?.length || 0) + (tsks?.length || 0);
          if (total === 0) { setSyncing(false); return; }
          setSyncProgress({ current: 0, total });
          let progress = 0;

          if (atts?.length) {
            for (const att of atts) {
              try {
                if (att.type === 'check-in') await api.post('/attendance/check-in', { timestamp: att.timestamp });
                else if (att.type === 'check-out') await api.post('/attendance/check-out', { timestamp: att.timestamp });
              } catch (_) {}
              progress++;
              setSyncProgress({ current: progress, total });
            }
            await clearOfflineAttendance();
          }
          if (tsks?.length) {
            for (const tsk of tsks) {
              try { await api.put(`/tasks/${tsk.taskId}`, { status: tsk.status, notes: tsk.notes, latitude: tsk.latitude, longitude: tsk.longitude, accuracy: tsk.accuracy }); } catch (_) {}
              progress++;
              setSyncProgress({ current: progress, total });
            }
            await clearOfflineTasks();
          }
          if (locs?.length) {
            for (const log of locs) { sendLocationUpdate({ ...log, isOfflineSync: true }); progress++; setSyncProgress({ current: progress, total }); }
            await clearOfflineLocations();
          }
          const [taskRes, attRes] = await Promise.all([api.get('/tasks'), api.get('/attendance')]);
          setTasks(taskRes.data.data);
          setAttendanceHistory(attRes.data.data.slice(0, 10));
        } catch (_) {} finally {
          setSyncing(false);
          setSyncProgress({ current: 0, total: 0 });
          updateOfflineCount();
        }
      }
    };
    syncOfflineData();
  }, [connected]);

  useEffect(() => {
    const fetchMyData = async () => {
      setLoading(true);
      try {
        const [taskRes, attRes] = await Promise.all([api.get('/tasks'), api.get('/attendance')]);
        setTasks(taskRes.data.data);
        setAttendanceHistory(attRes.data.data.slice(0, 10));
      } catch (_) {} finally { setLoading(false); }
    };
    fetchMyData();
  }, []);

  useEffect(() => {
    if (isOnDuty && checkInTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - checkInTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(timerRef.current);
  }, [isOnDuty, checkInTime]);

  const startDuty = async () => {
    const ua = navigator.userAgent;
    const deviceInfo = {
      os: ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : ua.includes('Windows') ? 'Windows' : 'macOS',
      browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : 'Other',
      deviceType: /Android|iPhone|iPad/.test(ua) ? 'Mobile' : 'Desktop',
    };
    try {
      if (connected) await api.post('/attendance/check-in', { deviceInfo });
      else { await saveOfflineAttendance({ type: 'check-in', timestamp: new Date().toISOString() }); updateOfflineCount(); }
      setIsOnDuty(true);
      setCheckInTime(Date.now());
      if ('geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude: lat, longitude: lng, speed, accuracy: acc } = pos.coords;
            setLocation({ lat, lng });
            setAccuracy(acc);
            const locData = { lat, lng, speed, accuracy: acc, battery, deviceInfo };
            if (connected) sendLocationUpdate(locData);
            else { saveOfflineLocation(locData); updateOfflineCount(); }
          },
          (err) => console.error('GPS error:', err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        setWatchId(id);
      }
    } catch (err) { alert(err.response?.data?.message || 'Failed to start duty'); }
  };

  const endDuty = async () => {
    try {
      if (connected) await api.post('/attendance/check-out');
      else { await saveOfflineAttendance({ type: 'check-out', timestamp: new Date().toISOString() }); updateOfflineCount(); }
      setIsOnDuty(false);
      setCheckInTime(null);
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
      if (connected) { const attRes = await api.get('/attendance'); setAttendanceHistory(attRes.data.data.slice(0, 10)); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to end duty'); }
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      const lat = location?.lat || null;
      const lng = location?.lng || null;
      const acc = accuracy || null;
      if (connected) {
        const formData = new FormData();
        formData.append('status', newStatus);
        if (newStatus === 'completed') {
          if (lat) { formData.append('latitude', lat); formData.append('longitude', lng); if (acc) formData.append('accuracy', acc); }
          else {
            try {
              const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 }));
              formData.append('latitude', pos.coords.latitude);
              formData.append('longitude', pos.coords.longitude);
              formData.append('accuracy', pos.coords.accuracy);
            } catch (_) {}
          }
        }
        await api.put(`/tasks/${taskId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await saveOfflineTask({ taskId, status: newStatus, notes: 'Completed offline on site.', latitude: lat, longitude: lng, accuracy: acc });
        updateOfflineCount();
      }
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) { alert(err.response?.data?.message || 'Failed to update task'); }
  };

  const myTasks = tasks;
  const completedTasks = myTasks.filter(t => t.status === 'completed').length;
  const pendingTasks = myTasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = myTasks.filter(t => t.status === 'in-progress').length;
  const completionRate = myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0;

  const filteredTasks = taskFilter === 'all' ? myTasks : myTasks.filter(t => t.status === taskFilter);

  const tabs = [
    { id: 'overview',    label: 'Overview' },
    { id: 'tasks',       label: `Tasks (${myTasks.length})` },
    { id: 'attendance',  label: 'Attendance' },
    { id: 'map',         label: 'My Location' },
  ];

  return (
    <div className="min-h-full">

      {/* ─── Hero Shift Section ──────────────────────────── */}
      <div className={`relative overflow-hidden ${
        isOnDuty
          ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
          : 'bg-gradient-to-br from-blue-600 to-indigo-700'
      }`}>
        {/* Background bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />
        </div>

        <div className="relative px-4 pt-5 pb-6">
          {/* Offline / Sync Banner */}
          {(!connected || offlineCount > 0) && (
            <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
              !connected ? 'bg-red-500/20 text-red-100' : 'bg-white/15 text-white'
            }`}>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${!connected ? 'bg-red-300 animate-pulse' : 'bg-white'}`} />
                {!connected ? `Offline Mode${offlineCount > 0 ? ` • ${offlineCount} logs queued` : ''}` : `Syncing ${offlineCount} offline logs...`}
              </span>
              {syncing && syncProgress.total > 0 && (
                <span className="flex items-center gap-1.5 shrink-0">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {syncProgress.current}/{syncProgress.total}
                </span>
              )}
            </div>
          )}

          <p className="text-white/70 text-sm font-medium mb-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-black text-white mb-4">
            Hey {user?.name?.split(' ')[0]} 👋
          </h1>

          {/* Big duty timer / off-duty state */}
          {isOnDuty ? (
            <div className="text-center mb-5">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Shift Timer</p>
              <p className="text-5xl font-black text-white tabular-nums tracking-tight">{elapsedTime}</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-emerald-200 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                GPS Tracking Active
              </div>
            </div>
          ) : (
            <div className="text-center mb-5">
              <p className="text-white/60 text-sm mb-1">You are currently</p>
              <p className="text-3xl font-black text-white/90">Off Duty</p>
            </div>
          )}

          {/* Duty Button */}
          {!isOnDuty ? (
            <button
              onClick={startDuty}
              className="w-full py-4 rounded-2xl bg-white text-blue-700 font-black text-lg shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <LogIn className="w-6 h-6" />
              Start Duty
            </button>
          ) : (
            <button
              onClick={endDuty}
              className="w-full py-4 rounded-2xl bg-white/15 border-2 border-white/30 text-white font-black text-lg active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <LogOut className="w-6 h-6" />
              End Duty
            </button>
          )}
        </div>
      </div>

      {/* ─── Live Telemetry Strip ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: 'Battery',  value: battery != null ? `${battery}%` : '—',  icon: Battery,    color: battery != null ? (battery > 20 ? 'text-emerald-500' : 'text-red-500') : 'text-slate-400' },
            { label: 'GPS',      value: accuracy ? `±${Math.round(accuracy)}m` : '—', icon: Navigation, color: accuracy ? 'text-blue-500' : 'text-slate-400' },
            { label: 'Network',  value: connected ? 'Online' : 'Offline',        icon: connected ? Wifi : WifiOff, color: connected ? 'text-emerald-500' : 'text-red-500' },
            { label: 'Location', value: location ? `${location.lat.toFixed(3)},${location.lng.toFixed(3)}` : 'Waiting', icon: MapPin, color: location ? 'text-indigo-500' : 'text-slate-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
              <Icon className={`w-4 h-4 ${color} shrink-0`} />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">{label}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 leading-none">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 sticky top-14 z-20">
        <div className="flex overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-3.5 text-sm font-bold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────── */}
      <div className="p-4 space-y-4">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Tasks',    value: myTasks.length,    color: 'from-blue-500 to-indigo-600',    icon: ClipboardList },
                { label: 'Completed',      value: completedTasks,    color: 'from-emerald-500 to-teal-500',   icon: CheckCircle2 },
                { label: 'In Progress',    value: inProgressTasks,   color: 'from-amber-500 to-orange-500',   icon: Activity },
                { label: 'Success Rate',   value: `${completionRate}%`, color: 'from-purple-500 to-pink-500', icon: TrendingUp },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0 shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 font-semibold leading-tight">{label}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Tasks Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">Recent Tasks</h2>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-xs text-blue-500 font-bold flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-sm"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading...</div>
                ) : myTasks.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No tasks assigned yet.</div>
                ) : myTasks.slice(0, 4).map(task => {
                  const cfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
                  return (
                    <div key={task._id} className="px-4 py-3.5 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{task.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Due: {task.date}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SOS Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/30 shadow-sm p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white mb-1">Emergency SOS</h2>
              <p className="text-slate-500 text-xs mb-4">Only use in a genuine emergency. Admin will be alerted with your location instantly.</p>
              <SOSButton lat={location?.lat} lng={location?.lng} />
            </div>
          </>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { key: 'all',         label: 'All',         count: myTasks.length },
                { key: 'pending',     label: 'Pending',     count: pendingTasks },
                { key: 'in-progress', label: 'In Progress', count: inProgressTasks },
                { key: 'completed',   label: 'Completed',   count: completedTasks },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTaskFilter(key)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    taskFilter === key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label} <span className={taskFilter === key ? 'text-blue-200' : 'text-slate-400'}>{count}</span>
                </button>
              ))}
            </div>

            {/* Task cards */}
            {loading ? (
              <div className="text-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /></div>
            ) : filteredTasks.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <Target className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-semibold text-slate-500 text-sm">No tasks here</p>
              </div>
            ) : filteredTasks.map(task => {
              const cfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
              return (
                <div key={task._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${cfg.dot}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm flex-1">{task.title}</h3>
                      <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        Due: {task.date}
                      </span>
                      <select
                        value={task.status}
                        onChange={e => handleTaskStatusChange(task._id, e.target.value)}
                        className="pl-2.5 pr-6 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">Attendance History</h2>
              <span className="text-xs text-slate-400">Last 10 records</span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /></div>
            ) : attendanceHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-semibold text-slate-500 text-sm">No records yet</p>
                <p className="text-xs text-slate-400 mt-1">Start duty to begin tracking</p>
              </div>
            ) : attendanceHistory.map(att => (
              <div key={att._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{att.date}</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${
                    att.status === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    att.status === 'absent'  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>{att.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Check In</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Check Out</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-500">Active</span>}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Hours</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {att.workingHours ? `${att.workingHours}h` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">My Live Location</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {location
                    ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} • ±${accuracy ? Math.round(accuracy) : '?'}m`
                    : 'Start duty to enable GPS tracking'}
                </p>
              </div>
              {!isOnDuty && (
                <button onClick={startDuty} className="text-xs bg-blue-600 text-white font-bold px-3 py-2 rounded-xl">
                  Start Duty
                </button>
              )}
            </div>
            <div style={{ height: 'calc(100dvh - 380px)', minHeight: '320px' }}>
              <MapView
                center={location ?? { lat: 20.5937, lng: 78.9629 }}
                myLocation={location ? { ...location, accuracy } : null}
                zoom={location ? 16 : 5}
                height="100%"
                employees={[]}
                geofences={[]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-2" />
    </div>
  );
}
