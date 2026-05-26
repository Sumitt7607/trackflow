import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import MapView from '../components/Map';
import {
  Navigation, Plus, Trash2, MapPin, CheckCircle2, Clock,
  AlertTriangle, User, Calendar, X, Play, Loader2, ArrowRight, Check, Compass, ArrowLeft
} from 'lucide-react';

const STATUS_CFG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Play },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  deviated: { label: 'Deviated', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

export default function RoutesPage() {
  const { user, isAdmin } = useAuth();
  
  // Core lists
  const [routes, setRoutes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'

  // Create route form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    assignedTo: '',
    date: new Date().toISOString().split('T')[0],
  });
  
  const [waypoints, setWaypoints] = useState([
    { lat: '', lng: '', address: '' }
  ]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [routeRes, empRes] = await Promise.all([
        api.get('/routes'),
        isAdmin ? api.get('/employees') : Promise.resolve({ data: { data: [] } }),
      ]);
      setRoutes(routeRes.data.data);
      if (isAdmin) setEmployees(empRes.data.data);
    } catch (err) {
      console.error('Failed to fetch routes data', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Handle waypoint inputs
  const handleWaypointChange = (index, field, value) => {
    const updated = [...waypoints];
    updated[index][field] = value;
    setWaypoints(updated);
  };

  const addWaypointField = () => {
    setWaypoints([...waypoints, { lat: '', lng: '', address: '' }]);
  };

  const removeWaypointField = (index) => {
    if (waypoints.length > 1) {
      setWaypoints(waypoints.filter((_, idx) => idx !== index));
    }
  };

  const [optimizing, setOptimizing] = useState(false);

  const handleOptimizeStops = async () => {
    if (waypoints.some(wp => !wp.lat || !wp.lng || !wp.address)) {
      alert('Please fill out all waypoint fields with coordinates before optimizing.');
      return;
    }
    setOptimizing(true);
    try {
      const parsed = waypoints.map(wp => ({
        lat: parseFloat(wp.lat),
        lng: parseFloat(wp.lng),
        address: wp.address,
      }));
      const res = await api.post('/routes/optimize', { waypoints: parsed });
      if (res.data.success) {
        setWaypoints(res.data.data);
        alert(`Route Optimized! Total distance: ${res.data.distance} km`);
      }
    } catch (err) {
      console.warn('Backend optimize failed, utilizing client-side fallback:', err.message);
      // Greedy Nearest Neighbor client-side fallback
      try {
        const unvisited = waypoints.map(wp => ({
          lat: parseFloat(wp.lat),
          lng: parseFloat(wp.lng),
          address: wp.address,
        }));
        const optimized = [unvisited.shift()];
        let current = optimized[0];
        
        while (unvisited.length > 0) {
          let nearestIndex = 0;
          let nearestDistance = Infinity;
          for (let i = 0; i < unvisited.length; i++) {
            const dy = unvisited[i].lat - current.lat;
            const dx = unvisited[i].lng - current.lng;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDistance) {
              nearestDistance = dist;
              nearestIndex = i;
            }
          }
          current = unvisited.splice(nearestIndex, 1)[0];
          optimized.push(current);
        }
        setWaypoints(optimized);
        alert('Route optimized! (Local metric optimization applied)');
      } catch (_) {}
    } finally {
      setOptimizing(false);
    }
  };

  // Create route handler
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (waypoints.some(wp => !wp.lat || !wp.lng || !wp.address)) {
      alert('Please fill out all waypoint fields with valid locations.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        waypoints: waypoints.map(wp => ({
          lat: parseFloat(wp.lat),
          lng: parseFloat(wp.lng),
          address: wp.address,
        })),
      };
      const res = await api.post('/routes', payload);
      setForm({
        name: '',
        description: '',
        assignedTo: '',
        date: new Date().toISOString().split('T')[0],
      });
      setWaypoints([{ lat: '', lng: '', address: '' }]);
      setShowCreateModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign route');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete route
  const handleDeleteRoute = async (id, name) => {
    if (!window.confirm(`Delete route assignment "${name}"?`)) return;
    try {
      await api.delete(`/routes/${id}`);
      setRoutes(prev => prev.filter(r => r._id !== id));
      if (selectedRoute?._id === id) setSelectedRoute(null);
    } catch (err) {
      alert('Failed to delete route');
    }
  };

  // Update employee status on route waypoints
  const handleToggleWaypoint = async (routeId, waypointId, currentlyVisited) => {
    try {
      const res = await api.put(`/routes/${routeId}`, {
        waypointId,
        isVisited: !currentlyVisited,
      });
      // Update local state
      setRoutes(prev => prev.map(r => r._id === routeId ? res.data.data : r));
      if (selectedRoute?._id === routeId) {
        setSelectedRoute(res.data.data);
      }
    } catch (err) {
      alert('Failed to update waypoint status');
    }
  };

  // Update route status (e.g. Start Duty on route)
  const handleUpdateRouteStatus = async (routeId, newStatus) => {
    try {
      const res = await api.put(`/routes/${routeId}`, { status: newStatus });
      setRoutes(prev => prev.map(r => r._id === routeId ? res.data.data : r));
      if (selectedRoute?._id === routeId) {
        setSelectedRoute(res.data.data);
      }
    } catch (err) {
      alert('Failed to update route status');
    }
  };

  // Filters
  const filteredRoutes = filter === 'all' ? routes : routes.filter(r => r.status === filter);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Route Assignments</h1>
          <p className="text-slate-500">Plan waypoints, track stops, and monitor course deviations for field staff.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            Assign Route
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Routes' },
          { key: 'pending', label: 'Pending' },
          { key: 'in-progress', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
          { key: 'deviated', label: 'Deviated' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all border shrink-0 ${
              filter === key
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Routes list — full width on mobile unless detail is shown */}
        <div className={`xl:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1 ${
          mobileView === 'detail' ? 'hidden xl:block' : 'block'
        }`}>
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading routes...
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <Navigation className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No routes found</p>
              <p className="text-sm text-slate-400 mt-1">Assignments matching filter will display here.</p>
            </div>
          ) : (
            filteredRoutes.map(route => {
              const cfg = STATUS_CFG[route.status] || STATUS_CFG.pending;
              const isSelected = selectedRoute?._id === route._id;
              const visitedStops = route.waypoints.filter(w => w.isVisited).length;
              return (
                <div
                  key={route._id}
                  onClick={() => {
                    setSelectedRoute(route);
                    setMobileView('detail');
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{route.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {route.description && (
                    <p className="text-xs text-slate-500 mb-3 truncate">{route.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-y-1 justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {isAdmin ? route.assignedTo?.name : 'My Route'}
                    </span>
                    <span>📍 {visitedStops} / {route.waypoints.length} stops</span>
                    <span>🛣 {route.distance} km</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Map & details — full width on mobile when detail is shown */}
        <div className={`xl:col-span-2 space-y-4 ${
          mobileView === 'detail' ? 'block' : 'hidden xl:block'
        }`}>
          {selectedRoute ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-sm space-y-5 md:space-y-6">
              {/* Mobile back button */}
              <button
                className="xl:hidden flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-brand-500 transition-colors -mt-1 mb-1"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeft className="w-4 h-4" /> Back to Routes
              </button>
              {/* Route details banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedRoute.name}
                    {selectedRoute.status === 'deviated' && (
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Off course
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedRoute.description || 'No description provided.'}</p>
                  <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date: {selectedRoute.date}</span>
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assigned: <strong>{selectedRoute.assignedTo?.name}</strong></span>
                    <span>🛣 Distance: <strong>{selectedRoute.distance} km</strong></span>
                  </div>
                </div>
                {/* Delete Route */}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteRoute(selectedRoute._id, selectedRoute.name)}
                    className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all self-start md:self-auto"
                    title="Delete route assignment"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
                {/* Employee Start/Complete triggers */}
                {!isAdmin && (
                  <div className="flex items-center gap-2">
                    {selectedRoute.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateRouteStatus(selectedRoute._id, 'in-progress')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-1.5 transition-all"
                      >
                        <Play className="w-4 h-4" /> Start Route
                      </button>
                    )}
                    {selectedRoute.status === 'in-progress' && (
                      <button
                        onClick={() => handleUpdateRouteStatus(selectedRoute._id, 'completed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-1.5 transition-all"
                      >
                        <Check className="w-4 h-4" /> Finish Route
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Waypoint list and Map */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stop checklists */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Waypoints & Stops</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedRoute.waypoints.map((wp, idx) => (
                      <div
                        key={wp._id}
                        onClick={() => {
                          // Allow manual checkin toggle for employee or admin override
                          handleToggleWaypoint(selectedRoute._id, wp._id, wp.isVisited);
                        }}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                          wp.isVisited
                            ? 'bg-emerald-500/5 border-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                          wp.isVisited ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {wp.isVisited ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${wp.isVisited ? 'text-slate-800 dark:text-slate-200 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                            {wp.address}
                          </p>
                          {wp.visitedAt && (
                            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                              Checked: {new Date(wp.visitedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          {wp.isVisited ? 'Visited' : 'Tap to check'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map panel */}
                <div className="h-64 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <MapView
                    center={{ lat: selectedRoute.waypoints[0]?.lat, lng: selectedRoute.waypoints[0]?.lng }}
                    zoom={13}
                    routeWaypoints={selectedRoute.waypoints}
                    height="100%"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl h-[450px] flex flex-col items-center justify-center text-slate-400 shadow-inner">
              <Compass className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-semibold text-slate-500">No route selected</p>
              <p className="text-sm text-slate-400 mt-1">Select a route from the sidebar to inspect stops & status.</p>
            </div>
          )}
        </div>
      </div>

      {/* Assign Route Modal (Admin Only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assign Route</h2>
                <p className="text-xs text-slate-500 mt-0.5">Design waypoints and assign them to an employee</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setWaypoints([{ lat: '', lng: '', address: '' }]);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-5">
              {/* Route details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Route Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. North Area Client Visits"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Audit stores 1, 2 and 3"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assign Employee *</label>
                  <select
                    required
                    value={form.assignedTo}
                    onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Waypoints Array */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Route Waypoints</h3>
                  <div className="flex items-center gap-3">
                    {waypoints.length > 1 && (
                      <button
                        type="button"
                        onClick={handleOptimizeStops}
                        disabled={optimizing}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
                        Optimize Stops
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addWaypointField}
                      className="text-xs text-brand-500 hover:text-brand-600 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Stop
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="flex gap-2.5 items-end border border-slate-100 dark:border-slate-800 p-3 rounded-xl relative">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          required
                          value={wp.address}
                          onChange={e => handleWaypointChange(idx, 'address', e.target.value)}
                          placeholder="Stop Address / Client Name"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="any"
                            required
                            value={wp.lat}
                            onChange={e => handleWaypointChange(idx, 'lat', e.target.value)}
                            placeholder="Latitude (e.g. 28.61)"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none text-xs"
                          />
                          <input
                            type="number"
                            step="any"
                            required
                            value={wp.lng}
                            onChange={e => handleWaypointChange(idx, 'lng', e.target.value)}
                            placeholder="Longitude (e.g. 77.20)"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeWaypointField(idx)}
                        disabled={waypoints.length === 1}
                        className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all disabled:opacity-50 shrink-0 align-bottom h-9"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setWaypoints([{ lat: '', lng: '', address: '' }]);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                  {submitting ? 'Assigning...' : 'Assign Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
