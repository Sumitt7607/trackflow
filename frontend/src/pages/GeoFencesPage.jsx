const CATEGORY_STYLES = {
  office: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50',
  restricted: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-pulse',
  regular: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50',
};

const CATEGORY_LABELS = {
  office: 'Office Zone',
  restricted: 'Restricted Area',
  regular: 'Regular Area',
};
import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import MapView from '../components/Map';
import { Navigation, Plus, Loader2, MapPin, Trash2, Shield, Info, CheckCircle2, X } from 'lucide-react';

export default function GeoFencesPage() {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedFence, setSelectedFence] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    lat: '',
    lng: '',
    radius: 100,
    alertOnEntry: true,
    alertOnExit: true,
    category: 'regular',
  });

  const fetchGeofences = useCallback(async () => {
    try {
      const res = await api.get('/geofences');
      setGeofences(res.data.data);
    } catch (err) {
      console.error('Failed to fetch geofences', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        type: 'circle',
        circleCenter: {
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
        },
        radius: parseFloat(form.radius),
        alertOnEntry: form.alertOnEntry,
        alertOnExit: form.alertOnExit,
        category: form.category,
      };
      await api.post('/geofences', payload);
      setForm({ name: '', lat: '', lng: '', radius: 100, alertOnEntry: true, alertOnExit: true, category: 'regular' });
      setSuccessMsg(`Geofence "${payload.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchGeofences();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create geofence');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete geofence "${name}"? This action cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/geofences/${id}`);
      setGeofences(prev => prev.filter(f => f._id !== id));
      if (selectedFence?._id === id) setSelectedFence(null);
    } catch (err) {
      alert('Failed to delete geofence');
    } finally {
      setDeleting(null);
    }
  };

  // Build geofence objects for the map
  const mapGeofences = geofences.map(fence => {
    if (fence.type === 'circle') {
      return {
        ...fence,
        circleCenter: fence.circleCenter || { lat: 0, lng: 0 }
      };
    }
    return fence;
  });

  const selectedMapFence = selectedFence ? (
    selectedFence.type === 'circle' ? selectedFence.circleCenter : selectedFence.polygonCoordinates?.[0]
  ) : null;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Geo-Fences</h1>
          <p className="text-slate-500">Configure operational surveillance zones for automatic attendance & alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl font-semibold text-sm border border-emerald-500/20">
            <Shield className="w-4 h-4" />
            {geofences.length} Active Zone{geofences.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-2xl shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Create Form */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-purple-600" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Zone</h2>
                <p className="text-xs text-slate-400 font-medium">Circular geofence boundary</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Zone Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Head Office, Warehouse A"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Zone Category *</label>
                <select
                  required
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="regular">Regular Area (Standard tracking)</option>
                  <option value="office">Office Zone (Automates Attendance)</option>
                  <option value="restricted">Restricted Area (Breach Security Alerts)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={form.lat}
                    onChange={e => setForm({ ...form, lat: e.target.value })}
                    placeholder="28.6139"
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={form.lng}
                    onChange={e => setForm({ ...form, lng: e.target.value })}
                    placeholder="77.2090"
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Radius: <span className="text-brand-500 font-bold">{form.radius} meters</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={form.radius}
                  onChange={e => setForm({ ...form, radius: parseInt(e.target.value) })}
                  className="w-full accent-brand-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1 font-semibold">
                  <span>50m</span>
                  <span>5000m</span>
                </div>
              </div>

              {/* Alert Toggles */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alert Triggers</p>
                {[
                  { key: 'alertOnEntry', label: 'Alert on Entry', desc: 'Notify when employee enters zone' },
                  { key: 'alertOnExit', label: 'Alert on Exit', desc: 'Notify when employee exits zone' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                      <p className="text-xs text-slate-400 font-medium">{desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      className={`w-11 h-6 rounded-full relative transition-all ${form[key] ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form[key] ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {creating ? 'Creating...' : 'Create Geofence'}
              </button>
            </form>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-900/40 rounded-3xl p-5 shadow-sm">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-bold mb-1">Zone Rule Automation</p>
                <p className="text-blue-600/80 dark:text-blue-400/80 text-xs leading-relaxed font-semibold">
                  • <strong>Office Zones</strong> automate attendance logging and timestamps.<br />
                  • <strong>Restricted Areas</strong> flag instant security alarms and record audit breaches.<br />
                  • <strong>Regular Areas</strong> act as standard client check points.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Map + Zone List */}
        <div className="xl:col-span-2 space-y-4">
          {/* Map Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Zone Map Preview</h2>
              {selectedFence && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-brand-500 font-bold">{selectedFence.name}</span>
                  <button
                    onClick={() => setSelectedFence(null)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}
              {!selectedFence && (
                <p className="text-xs text-slate-400 font-semibold">Click a zone from the list to focus</p>
              )}
            </div>
            <div className="h-72">
              <MapView
                center={selectedMapFence || { lat: 20.5937, lng: 78.9629 }}
                zoom={selectedMapFence ? 14 : 5}
                flyTo={selectedMapFence}
                geofences={mapGeofences}
                employees={[]}
                height="100%"
              />
            </div>
          </div>

          {/* Zone List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white">Active Zones</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">{geofences.length} configured geofence{geofences.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <div className="text-center text-slate-400 py-10">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading geofences...
                </div>
              ) : geofences.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <Navigation className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="font-bold">No geo-fences configured</p>
                  <p className="text-sm mt-1 text-slate-400">Use the form on the left to create your first zone.</p>
                </div>
              ) : (
                geofences.map(fence => {
                  const isSelected = selectedFence?._id === fence._id;
                  const lat = fence.type === 'circle' ? fence.circleCenter?.lat : fence.polygonCoordinates?.[0]?.lat;
                  const lng = fence.type === 'circle' ? fence.circleCenter?.lng : fence.polygonCoordinates?.[0]?.lng;
                  return (
                    <div
                      key={fence._id}
                      onClick={() => setSelectedFence(isSelected ? null : fence)}
                      className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-500/5 dark:bg-brand-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-brand-500/20 text-brand-600' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <MapPin className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                            {fence.name}
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              CATEGORY_STYLES[fence.category] || CATEGORY_STYLES.regular
                            }`}>
                              {CATEGORY_LABELS[fence.category] || CATEGORY_LABELS.regular}
                            </span>
                          </h3>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500 font-semibold">
                            <span>📍 {lat !== undefined && lat !== null ? lat.toFixed(5) : '—'}, {lng !== undefined && lng !== null ? lng.toFixed(5) : '—'}</span>
                            <span>⭕ Radius: <strong>{fence.radius}m</strong></span>
                            <span>📐 Type: <strong className="capitalize">{fence.type}</strong></span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(fence._id, fence.name); }}
                        disabled={deleting === fence._id}
                        className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all shrink-0 disabled:opacity-50"
                        title="Delete Geo-Fence"
                      >
                        {deleting === fence._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
