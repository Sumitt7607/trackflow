import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import MapView from '../components/Map';
import {
  Users, Navigation, Search, RefreshCw, Battery,
  Clock, Wifi, WifiOff, MapPin, AlertCircle, Filter,
  ChevronRight, Activity, Signal, Map, List
} from 'lucide-react';

export default function LiveMapPage() {
  const { employeeLocations, connected } = useSocket();
  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [mobileView, setMobileView] = useState('map'); // 'map' | 'list'

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [empRes, geoRes] = await Promise.all([
        api.get('/employees'),
        api.get('/geofences')
      ]);
      setEmployees(empRes.data.data);
      setGeofences(geoRes.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch data for live map', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Merge real-time socket updates
  const mergedEmployees = employees.map(emp => {
    const socketUpdate = employeeLocations[emp._id];
    return socketUpdate ? { ...emp, ...socketUpdate } : emp;
  });

  const onlineEmployees = mergedEmployees.filter(e => e.status === 'online');
  const offlineEmployees = mergedEmployees.filter(e => e.status !== 'online');

  const filteredEmployees = mergedEmployees.filter(emp => {
    const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || emp.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleFocusEmployee = (emp) => {
    setSelectedEmployee(emp._id);
    const loc = emp.location || emp.currentLocation;
    if (loc) {
      const lat = loc.latitude ?? loc.lat;
      const lng = loc.longitude ?? loc.lng;
      if (lat && lng) {
        setMapFocus({ lat, lng });
        setMobileView('map'); // auto-switch to map on mobile
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-[calc(100vh-64px)]">
      {/* Top Bar */}
      <div className="px-3 md:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Live Map</h1>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            connected
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected ? 'Live' : 'Off'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <strong className="text-slate-700 dark:text-slate-200">{onlineEmployees.length}</strong> Online
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <strong className="text-slate-700 dark:text-slate-200">{offlineEmployees.length}</strong> Offline
            </span>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile toggle bar */}
      <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <button
          onClick={() => setMobileView('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            mobileView === 'map'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400'
          }`}
        >
          <Map className="w-4 h-4" /> Map
        </button>
        <button
          onClick={() => setMobileView('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            mobileView === 'list'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400'
          }`}
        >
          <List className="w-4 h-4" /> Personnel ({mergedEmployees.length})
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on mobile when map is shown */}
        <div className={`w-full lg:w-72 xl:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden ${
          mobileView === 'list' ? 'flex' : 'hidden lg:flex'
        } shrink-0`}>
          {/* Search & Filter */}
          <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search personnel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>
            <div className="flex gap-1.5">
              {[
                { key: 'all', label: 'All', count: mergedEmployees.length },
                { key: 'online', label: 'Online', count: onlineEmployees.length },
                { key: 'offline', label: 'Offline', count: offlineEmployees.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    filterStatus === key
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>

          {/* Employee List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="text-center py-10 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No employees found
              </div>
            ) : (
              filteredEmployees.map(emp => {
                const loc = emp.location || emp.currentLocation;
                const hasLoc = !!(loc?.latitude || loc?.lat);
                const lat = hasLoc ? (loc.latitude ?? loc.lat) : null;
                const lng = hasLoc ? (loc.longitude ?? loc.lng) : null;
                const isSelected = selectedEmployee === emp._id;
                const isOnline = emp.status === 'online';
                const battery = emp.batteryLevel ?? null;
                const speed = emp.location?.speed ? Math.round(emp.location.speed * 3.6) : 0;

                return (
                  <div
                    key={emp._id}
                    onClick={() => handleFocusEmployee(emp)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    } ${!hasLoc && !isOnline ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{emp.name}</p>
                        <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 text-brand-500 shrink-0" />}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 text-center">
                        <p className="text-[10px] text-slate-400">Status</p>
                        <p className={`text-[11px] font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 text-center">
                        <p className="text-[10px] text-slate-400">Battery</p>
                        <p className={`text-[11px] font-bold ${battery !== null ? (battery > 20 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-400'}`}>
                          {battery !== null ? `${battery}%` : '—'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 text-center">
                        <p className="text-[10px] text-slate-400">Speed</p>
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{speed} km/h</p>
                      </div>
                    </div>

                    {hasLoc && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{lat?.toFixed(4)}, {lng?.toFixed(4)}</span>
                      </div>
                    )}

                    {!hasLoc && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 italic">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>No GPS data available</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Stats */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1">
                <Signal className="w-3 h-3" />
                {connected ? 'Real-time' : 'Polling'}
              </span>
            </div>
          </div>
        </div>

        {/* Map Area */}
        <div className={`flex-1 relative ${ mobileView === 'list' ? 'hidden lg:flex lg:flex-1' : 'flex flex-1' }`}>
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-500" />
              <p className="text-sm font-medium">Loading map data...</p>
            </div>
          ) : (
            <MapView
              employees={mergedEmployees}
              geofences={geofences}
              flyTo={mapFocus}
              height="100%"
            />
          )}

          {/* Map Legend */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-lg text-xs space-y-1.5 z-[999]">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Legend</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400">Online Employee</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Offline Employee</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-amber-500 bg-amber-500/20" />
              <span className="text-slate-500 dark:text-slate-400">Geofence Zone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
