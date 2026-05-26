import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import {
  Users, ShieldAlert, Navigation, Clock, Search,
  Play, Pause, SkipForward, SkipBack, MapPin,
  TrendingUp, CheckCircle2, Map, Flame, RefreshCw,
  AlertTriangle, FileText, Check, X, Calendar,
  List, LayoutGrid
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, Legend
} from 'recharts';
import MapView from '../components/Map';

// Haversine formula to compute distance in km
const calculateDistance = (coords) => {
  if (coords.length < 2) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  let total = 0;
  const R = 6371; // Earth's radius in km

  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i].latitude ?? coords[i].lat;
    const lon1 = coords[i].longitude ?? coords[i].lng;
    const lat2 = coords[i + 1].latitude ?? coords[i + 1].lat;
    const lon2 = coords[i + 1].longitude ?? coords[i + 1].lng;

    if (!lat1 || !lon1 || !lat2 || !lon2) continue;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return Math.round(total * 100) / 100;
};

export default function AdminDashboard() {
  const { employeeLocations, notifications, sosAlerts, dismissSOS } = useSocket();
  
  // Tabs: 'overview', 'live-map', 'route-replay', 'attendance', 'security'
  const [activeTab, setActiveTab] = useState('overview');

  // Mobile view toggles for split-panel tabs
  const [liveMapMobileView, setLiveMapMobileView] = useState('map'); // 'list' | 'map'
  const [replayMobileView, setReplayMobileView] = useState('controls'); // 'controls' | 'map'
  
  // Data States
  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters (Live Map)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [mapFocus, setMapFocus] = useState(null);

  // Route Replay States
  const [selectedEmpReplay, setSelectedEmpReplay] = useState('');
  const [replayDate, setReplayDate] = useState(new Date().toISOString().split('T')[0]);
  const [replayHistory, setReplayHistory] = useState([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier
  const [showHeatmap, setShowHeatmap] = useState(false);
  const playbackTimer = useRef(null);

  // Attendance Override Form State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '',
    checkOutTime: '',
    status: 'present',
    reason: '',
  });
  const [overrideError, setOverrideError] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Fetch all core dashboard data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [empRes, geoRes, taskRes, attRes] = await Promise.all([
        api.get('/employees'),
        api.get('/geofences'),
        api.get('/tasks'),
        api.get('/attendance')
      ]);
      setEmployees(empRes.data.data);
      setGeofences(geoRes.data.data);
      setTasks(taskRes.data.data);
      setAttendance(attRes.data.data);
    } catch (err) {
      console.error('Failed to fetch admin dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Merge socket location data in real time
  const mergedEmployees = employees.map(emp => {
    const socketUpdate = employeeLocations[emp._id];
    return socketUpdate ? { ...emp, ...socketUpdate } : emp;
  });

  const onlineEmployees = mergedEmployees.filter(e => e.status === 'online');
  const onlineCount = onlineEmployees.length;

  // Filtered employees for the Live Map sidebar
  const filteredEmployees = mergedEmployees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;

  // Build chart datasets
  const taskChartData = [
    { name: 'Completed', count: completedTasks, fill: '#10b981' },
    { name: 'In Progress', count: inProgressTasks, fill: '#3b82f6' },
    { name: 'Pending', count: pendingTasks, fill: '#f59e0b' },
  ];

  const attendanceChartData = attendance.slice(0, 10).map(att => ({
    name: att.employee?.name || 'Unknown',
    hours: att.workingHours || 0,
    status: att.status,
  })).reverse();

  // Load Route History for Replay
  const handleLoadReplay = async () => {
    if (!selectedEmpReplay) return;
    setReplayLoading(true);
    setReplayHistory([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
    try {
      const res = await api.get(`/employees/${selectedEmpReplay}/history?start=${replayDate}&end=${replayDate}`);
      setReplayHistory(res.data.data);
    } catch (err) {
      alert('Failed to load route history.');
    } finally {
      setReplayLoading(false);
    }
  };

  // Playback loop controller
  useEffect(() => {
    if (isPlaying && replayHistory.length > 0) {
      const interval = 1000 / playbackSpeed;
      playbackTimer.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= replayHistory.length - 1) {
            setIsPlaying(false);
            clearInterval(playbackTimer.current);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      clearInterval(playbackTimer.current);
    }

    return () => clearInterval(playbackTimer.current);
  }, [isPlaying, playbackSpeed, replayHistory]);

  const currentReplayPoint = replayHistory[playbackIndex] || null;
  const cumulativeDistance = calculateDistance(replayHistory.slice(0, playbackIndex + 1));

  // Handle Attendance Override Submit
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    setOverrideError('');
    setOverrideSubmitting(true);
    try {
      await api.post('/attendance/override', overrideForm);
      setIsOverrideModalOpen(false);
      fetchData(true);
    } catch (err) {
      setOverrideError(err.response?.data?.message || 'Failed to apply attendance correction');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* High priority SOS alert Banner */}
      {sosAlerts.length > 0 && (
        <div className="bg-red-500 text-white rounded-3xl p-5 shadow-lg shadow-red-500/20 animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-ping">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">EMERGENCY SOS ACTIVE</h3>
              <p className="text-white/80 text-sm">
                {sosAlerts[0].name} has triggered an SOS alarm.{sosAlerts[0].location?.lat != null ? ` Last coordinates: ${sosAlerts[0].location.lat.toFixed(4)}, ${sosAlerts[0].location.lng.toFixed(4)}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => dismissSOS(sosAlerts[0].employeeId)}
            className="bg-white text-red-600 font-bold px-5 py-2.5 rounded-xl hover:bg-red-50 transition-all shrink-0 text-sm shadow-md"
          >
            Dismiss Alert
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">Admin Command Center</h1>
            <p className="text-slate-500 text-xs md:text-sm hidden md:block">Real-time surveillance, geofencing, route replay, and force analytics.</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Scrollable Tab Bar */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'overview',     label: 'Surveillance' },
            { id: 'live-map',     label: 'Live Map' },
            { id: 'route-replay', label: 'Replay' },
            { id: 'attendance',   label: 'Attendance' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-500" />
          <p className="text-sm font-medium">Loading command center modules...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: SURVEILLANCE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPIs Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Field Personnel', value: employees.length, sub: `${onlineCount} Online Now`, icon: Users, color: 'from-brand-500 to-purple-600' },
                  { label: 'Active Geofences', value: geofences.length, sub: 'Surveillance Zones', icon: Navigation, color: 'from-emerald-500 to-teal-500' },
                  { label: 'Active Alerts', value: sosAlerts.length, sub: 'Immediate attention', icon: ShieldAlert, color: sosAlerts.length > 0 ? 'from-red-500 to-rose-600 animate-pulse' : 'from-slate-500 to-slate-600' },
                  { label: 'Assigned Tasks', value: totalTasks, sub: `${completedTasks} Completed`, icon: CheckCircle2, color: 'from-amber-500 to-orange-500' },
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{kpi.label}</p>
                      <p className="text-3xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
                      <p className="text-xs text-slate-400 font-semibold">{kpi.sub}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shrink-0`}>
                      <kpi.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Graphs Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Performance Chart */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Task Completion Distribution</h2>
                  <p className="text-xs text-slate-500 mb-6">Distribution of field force task statuses.</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: '12px' }} />
                        <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                          {taskChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Team Working Hours Chart */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Worker Working Hours</h2>
                  <p className="text-xs text-slate-500 mb-6">Daily work duration tracker based on GPS check-in logs.</p>
                  <div className="h-64">
                    {attendanceChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No recent attendance records.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={attendanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={12} />
                          <Tooltip contentStyle={{ borderRadius: '12px' }} />
                          <Area type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#hoursGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Alerts & Logs */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Surveillance Violations & Activity Logs</h2>
                  <p className="text-xs text-slate-500 mt-1">Live tracking logs broadcasted from field geofences.</p>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No recent geofence violations or system updates.</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif._id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            notif.type === 'sos' ? 'bg-red-500 animate-ping' :
                            notif.type === 'violation' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{notif.message}</p>
                            <p className="text-xs text-slate-400">{new Date(notif.createdAt).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        {notif.type === 'sos' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[10px] font-black rounded uppercase tracking-wider animate-pulse">SOS</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE MAP Surviellance */}
          {activeTab === 'live-map' && (
            <div>
              {/* Mobile toggle */}
              <div className="flex lg:hidden gap-2 mb-3">
                <button
                  onClick={() => setLiveMapMobileView('map')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    liveMapMobileView === 'map'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Map className="w-4 h-4" /> Map
                </button>
                <button
                  onClick={() => setLiveMapMobileView('list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    liveMapMobileView === 'list'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <List className="w-4 h-4" /> Personnel
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[650px]">
                {/* Left Panel: Employee list — always visible on desktop, toggle on mobile */}
                <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col shadow-sm ${
                  liveMapMobileView === 'list' ? 'flex' : 'hidden lg:flex'
                } lg:h-full`}>
                  <div className="space-y-3 mb-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Personnel</h2>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      {['all', 'online', 'offline'].map(st => (
                        <button
                          key={st}
                          onClick={() => setFilterStatus(st)}
                          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg capitalize border transition-all ${
                            filterStatus === st
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[400px] lg:max-h-none">
                    {filteredEmployees.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No employees match filters.</div>
                    ) : (
                      filteredEmployees.map(emp => {
                        const loc = emp.location || emp.currentLocation;
                        const hasLoc = !!(loc?.latitude || loc?.lat);
                        return (
                          <div
                            key={emp._id}
                            onClick={() => {
                              if (hasLoc) {
                                const lat = loc.latitude ?? loc.lat;
                                const lng = loc.longitude ?? loc.lng;
                                setMapFocus({ lat, lng });
                                setLiveMapMobileView('map');
                              }
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                              hasLoc ? 'hover:border-brand-500' : 'opacity-60 cursor-not-allowed'
                            } ${
                              mapFocus && hasLoc && (loc.latitude ?? loc.lat) === mapFocus.lat
                                ? 'bg-brand-500/5 border-brand-500 dark:border-brand-500'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${emp.status === 'online' ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-400'}`} />
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[140px]">{emp.name}</h4>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {Math.round((loc?.speed || 0) * 3.6)} km/h
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <div>🔋 {emp.batteryLevel ?? '—'}%</div>
                              <div className="text-right">🛰 ±{Math.round(emp.gpsAccuracy || 0)}m</div>
                              <div className="col-span-2 truncate">⏱ {emp.lastActive ? new Date(emp.lastActive).toLocaleTimeString() : 'Never'}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Panel: Map */}
                <div className={`lg:col-span-2 bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 relative shadow-sm ${
                  liveMapMobileView === 'map' ? 'block' : 'hidden lg:block'
                }`} style={{ minHeight: '400px' }}>
                  <MapView
                    employees={filteredEmployees}
                    geofences={geofences}
                    flyTo={mapFocus}
                    height="100%"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROUTE REPLAY MODULE */}
          {activeTab === 'route-replay' && (
            <div>
              {/* Mobile toggle */}
              <div className="flex lg:hidden gap-2 mb-3">
                <button
                  onClick={() => setReplayMobileView('controls')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    replayMobileView === 'controls'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> Controls
                </button>
                <button
                  onClick={() => setReplayMobileView('map')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    replayMobileView === 'map'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Map className="w-4 h-4" /> Map
                </button>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[650px]">
              {/* Left controller sidebar */}
              <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col shadow-sm lg:h-full ${
                replayMobileView === 'controls' ? 'flex' : 'hidden lg:flex'
              }`}>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Replay Controller</h2>
                
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Personnel</label>
                    <select
                      value={selectedEmpReplay}
                      onChange={e => {
                        setSelectedEmpReplay(e.target.value);
                        setReplayHistory([]);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-slate-900 dark:text-white"
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="date"
                        value={replayDate}
                        onChange={e => {
                          setReplayDate(e.target.value);
                          setReplayHistory([]);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleLoadReplay}
                    disabled={!selectedEmpReplay || replayLoading}
                    className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-brand-500/25 flex items-center justify-center gap-2"
                  >
                    {replayLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    {replayLoading ? 'Querying...' : 'Load History'}
                  </button>

                  {replayHistory.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      {/* Playback statistics */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Total Logs</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{replayHistory.length} points</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Distance Covered</span>
                          <span className="font-semibold text-brand-600 dark:text-brand-400">{cumulativeDistance} km</span>
                        </div>
                        {currentReplayPoint && (
                          <>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Playback Speed</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {Math.round((currentReplayPoint.speed || 0) * 3.6)} km/h
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Signal Accuracy</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                ±{Math.round(currentReplayPoint.accuracy || 0)}m
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Log Timestamp</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {new Date(currentReplayPoint.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Map Mode Toggles */}
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span>Heatmap Mode</span>
                        <button
                          onClick={() => setShowHeatmap(!showHeatmap)}
                          className={`w-9 h-5 rounded-full transition-all relative ${showHeatmap ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                          <span className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${showHeatmap ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      {/* Playback Controls */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => setPlaybackIndex(p => Math.max(0, p - 1))}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                          >
                            <SkipBack className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold"
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {isPlaying ? 'Pause' : 'Play'}
                          </button>
                          <button
                            onClick={() => setPlaybackIndex(p => Math.min(replayHistory.length - 1, p + 1))}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Slider bar */}
                        <div className="space-y-1">
                          <input
                            type="range"
                            min="0"
                            max={replayHistory.length - 1}
                            value={playbackIndex}
                            onChange={e => setPlaybackIndex(Number(e.target.value))}
                            className="w-full accent-brand-500 h-1 bg-slate-100 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>00:00</span>
                            <span>{playbackIndex + 1} / {replayHistory.length}</span>
                          </div>
                        </div>

                        {/* Playback Speed multipliers */}
                        <div className="flex gap-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-1">
                          {[1, 2, 5, 10].map(sp => (
                            <button
                              key={sp}
                              onClick={() => setPlaybackSpeed(sp)}
                              className={`flex-1 py-1 rounded text-[11px] font-bold transition-all ${
                                playbackSpeed === sp ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm' : 'text-slate-500'
                              }`}
                            >
                              {sp}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Replay Map */}
              <div className={`lg:col-span-2 bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 relative shadow-sm ${
                replayMobileView === 'map' ? 'block' : 'hidden lg:block'
              }`} style={{ minHeight: '400px' }}>
                {replayHistory.length > 0 ? (
                  <MapView
                    center={currentReplayPoint ? { lat: currentReplayPoint.latitude, lng: currentReplayPoint.longitude } : undefined}
                    employees={currentReplayPoint ? [{
                      _id: selectedEmpReplay,
                      name: employees.find(e => e._id === selectedEmpReplay)?.name,
                      status: 'online',
                      location: currentReplayPoint,
                      batteryLevel: currentReplayPoint.batteryLevel,
                      gpsAccuracy: currentReplayPoint.accuracy,
                      lastActive: currentReplayPoint.timestamp
                    }] : []}
                    routeHistory={replayHistory.slice(0, playbackIndex + 1)}
                    geofences={geofences}
                    showHeatmap={showHeatmap}
                    zoom={15}
                    height="100%"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900">
                    <Map className="w-12 h-12 mb-2 text-slate-300" />
                    <p className="text-sm font-semibold">No route log loaded.</p>
                    <p className="text-xs text-slate-500 mt-1">Select employee and hit Load History to replay.</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE Surviellance */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">GPS Attendance Sheet</h2>
                  <p className="text-xs text-slate-500 hidden md:block">Auto-captured when field staff cross geofence boundaries.</p>
                </div>
                <button
                  onClick={() => {
                    setOverrideForm({
                      employeeId: '',
                      date: new Date().toISOString().split('T')[0],
                      checkInTime: '',
                      checkOutTime: '',
                      status: 'present',
                      reason: '',
                    });
                    setOverrideError('');
                    setIsOverrideModalOpen(true);
                  }}
                  className="bg-brand-500 hover:bg-brand-600 text-white text-xs md:text-sm font-semibold px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">Override Record</span>
                  <span className="sm:hidden">Override</span>
                </button>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {attendance.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                    <p className="text-slate-400 text-sm">No attendance logs found.</p>
                  </div>
                ) : attendance.map(att => (
                  <div key={att._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{att.employee?.name || 'Deleted Employee'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{att.date}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${
                          att.status === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          att.status === 'absent'  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>{att.status}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">In</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Out</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Hours</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {att.workingHours ? `${att.workingHours}h` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Employee</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold">Check-In</th>
                        <th className="px-6 py-4 font-semibold">Check-Out</th>
                        <th className="px-6 py-4 font-semibold">Method</th>
                        <th className="px-6 py-4 font-semibold">Hours Worked</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {attendance.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-slate-400 text-sm">No attendance logs found in the database.</td>
                        </tr>
                      ) : (
                        attendance.map((att) => (
                          <tr key={att._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white">
                              {att.employee?.name || 'Deleted Employee'}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{att.date}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                att.checkInMethod === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {att.checkInMethod || 'auto'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              {att.workingHours ? `${att.workingHours} hrs` : '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                att.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                att.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {att.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Attendance Override Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Attendance Override</h2>
            <p className="text-slate-500 text-xs mb-6">Manually correct or enter working hours for personnel.</p>

            {overrideError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
                {overrideError}
              </div>
            )}

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Employee</label>
                <select
                  required
                  value={overrideForm.employeeId}
                  onChange={e => setOverrideForm(p => ({ ...p, employeeId: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    required
                    value={overrideForm.date}
                    onChange={e => setOverrideForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select
                    required
                    value={overrideForm.status}
                    onChange={e => setOverrideForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Check-In Time</label>
                  <input
                    type="datetime-local"
                    value={overrideForm.checkInTime}
                    onChange={e => setOverrideForm(p => ({ ...p, checkInTime: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Check-Out Time</label>
                  <input
                    type="datetime-local"
                    value={overrideForm.checkOutTime}
                    onChange={e => setOverrideForm(p => ({ ...p, checkOutTime: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason</label>
                <textarea
                  required
                  placeholder="Reason for manual override correction..."
                  value={overrideForm.reason}
                  onChange={e => setOverrideForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white h-20"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white font-semibold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {overrideSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
