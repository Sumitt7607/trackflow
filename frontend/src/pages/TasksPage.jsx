import { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  ClipboardList, Plus, Loader2, CheckCircle2,
  Clock, AlertCircle, User, Calendar, Trash2, X, ChevronDown
} from 'lucide-react';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: AlertCircle },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
};

export default function TasksPage() {
  const [tasks, setTasks]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [filter, setFilter]       = useState('all');
  const [form, setForm]           = useState({ title: '', description: '', assignedTo: '', date: '' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [taskRes, empRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/employees'),
      ]);
      setTasks(taskRes.data.data);
      setEmployees(empRes.data.data);
    } catch (err) {
      console.error('Failed to fetch tasks data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/tasks', form);
      setForm({ title: '', description: '', assignedTo: '', date: '' });
      setShowForm(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks(prev =>
        prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t)
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const counts = {
    all:         tasks.length,
    pending:     tasks.filter(t => t.status === 'pending').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed:   tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Task Management</h1>
          <p className="text-slate-500">Assign and track field tasks for your team.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Task
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'all',         label: 'Total',       color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
          { key: 'pending',     label: 'Pending',     color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { key: 'in-progress', label: 'In Progress', color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { key: 'completed',   label: 'Completed',   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`${bg} rounded-2xl p-4 text-left border-2 transition-all ${
              filter === key ? 'border-brand-500' : 'border-transparent'
            }`}
          >
            <p className={`text-3xl font-black ${color}`}>{counts[key]}</p>
            <p className="text-sm text-slate-500 font-semibold mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Task Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            Loading tasks...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-dashed border-slate-300 dark:border-slate-700">
            <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No tasks found</p>
            <p className="text-slate-400 text-sm mt-1">Click "New Task" to assign the first task.</p>
          </div>
        ) : (
          filtered.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            const StatusIcon = cfg.icon;
            return (
              <div
                key={task._id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-4 hover:border-brand-400/50 transition-colors shadow-sm"
              >
                {/* Left accent */}
                <div className={`hidden md:block w-1.5 self-stretch rounded-full ${
                  task.status === 'completed' ? 'bg-emerald-500' :
                  task.status === 'in-progress' ? 'bg-blue-500' : 'bg-amber-400'
                }`} />

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{task.title}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-500 mb-2 truncate">{task.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {task.assignedTo?.name || 'Unassigned'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {task.date}
                    </span>
                    {task.completedAt && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="mt-2 text-xs italic text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                      📝 {task.notes}
                    </p>
                  )}
                </div>

                {/* Status Dropdown */}
                <div className="shrink-0">
                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={e => handleStatusChange(task._id, e.target.value)}
                      className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assign New Task</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Task Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Site Inspection at Zone A"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional task details..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assign To *</label>
                  <select
                    required
                    value={form.assignedTo}
                    onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                  >
                    <option value="">Select employee</option>
                    {employees.map(e => (
                      <option key={e._id} value={e._id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {creating ? 'Creating...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
