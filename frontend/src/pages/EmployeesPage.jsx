import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { Users, Battery, Navigation, Clock, Loader2, Plus, Trash2, X } from 'lucide-react';

export default function EmployeesPage() {
  const { employeeLocations } = useSocket();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal and addition states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const activeEmployees = employees.map(emp => {
    const socketUpdate = employeeLocations[emp._id];
    return socketUpdate ? { ...emp, ...socketUpdate } : emp;
  });

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setFormError('Please fill out all fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/employees', { name, email, password });
      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      fetchEmployees();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id, empName) => {
    if (!window.confirm(`Are you sure you want to delete ${empName}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/employees/${id}`);
      setEmployees(prev => prev.filter(emp => emp._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete employee');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Employees</h1>
          <p className="text-slate-500">Manage field force personnel and check their live status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-brand-500/25 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
          <div className="flex items-center gap-2 bg-brand-500/10 text-brand-700 dark:text-brand-400 px-4 py-2 rounded-xl font-semibold">
            <Users className="w-5 h-5" />
            {activeEmployees.length} Total
          </div>
        </div>
      </div>

      {/* Desktop view: Table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Device</th>
                <th className="px-6 py-4 font-semibold">Last Active</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading employees...
                  </td>
                </tr>
              ) : activeEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No employees found in the system.
                  </td>
                </tr>
              ) : activeEmployees.map((emp) => (
                <tr key={emp._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      emp.status === 'online' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {emp.status === 'online' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
                      )}
                      {emp.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    {emp.currentLocation || emp.location ? (
                      <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-brand-500" />
                        <span className="text-xs">
                          {(emp.currentLocation?.latitude || emp.location?.lat)?.toFixed(4)}, {(emp.currentLocation?.longitude || emp.location?.lng)?.toFixed(4)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Battery className={`w-4 h-4 ${
                        emp.batteryLevel != null 
                          ? (emp.batteryLevel > 20 ? 'text-emerald-500' : 'text-red-500') 
                          : 'text-slate-400'
                      }`} />
                      <span className="text-slate-600 dark:text-slate-300 text-xs font-medium">
                        {emp.batteryLevel != null ? `${emp.batteryLevel}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-xs">
                        {emp.lastActive ? new Date(emp.lastActive).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                      className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200"
                      title="Delete Employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view: Card List */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading employees...
          </div>
        ) : activeEmployees.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm text-slate-400">
            No employees found in the system.
          </div>
        ) : (
          activeEmployees.map((emp) => (
            <div key={emp._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden">
              <div className="flex items-center gap-3 justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{emp.name}</p>
                    <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                  </div>
                </div>

                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  emp.status === 'online' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {emp.status === 'online' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1" />
                  )}
                  {emp.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                  {emp.currentLocation || emp.location ? (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                      <Navigation className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span className="truncate">
                        {(emp.currentLocation?.latitude || emp.location?.lat)?.toFixed(4)}, {(emp.currentLocation?.longitude || emp.location?.lng)?.toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Unknown</span>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Battery</p>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                    <Battery className={`w-3.5 h-3.5 ${
                      emp.batteryLevel != null 
                        ? (emp.batteryLevel > 20 ? 'text-emerald-500' : 'text-red-500') 
                        : 'text-slate-400'
                    } shrink-0`} />
                    <span>{emp.batteryLevel != null ? `${emp.batteryLevel}%` : '—'}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Last Active</p>
                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{emp.lastActive ? new Date(emp.lastActive).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 transition-all font-semibold"
                  title="Delete Employee"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden transition-all transform scale-100">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Add New Employee</h2>
            <p className="text-slate-500 text-sm mb-6">Create credentials for a new field employee.</p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-4 py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white font-semibold px-4 py-3 rounded-xl shadow-md shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

