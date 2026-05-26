import { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  BarChart2, Download, FileText, Users,
  Clock, CheckCircle2, Loader2, Calendar
} from 'lucide-react';

export default function ReportsPage() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    end: new Date().toISOString().split('T')[0],                        // Today
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, taskRes] = await Promise.all([
        api.get('/employees'),
        api.get('/tasks'),
      ]);
      setEmployees(empRes.data.data);
      setTasks(taskRes.data.data);
      if (empRes.data.data.length > 0) {
        setSelectedEmpId(empRes.data.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch report data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedEmpId) {
      alert('Please select an employee first.');
      return;
    }
    setDownloading(true);
    try {
      const res = await api.get(`/reports/pdf?employeeId=${selectedEmpId}&start=${dateRange.start}&end=${dateRange.end}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const empName = employees.find(e => e._id === selectedEmpId)?.name || 'Employee';
      link.setAttribute('download', `TrackFlow_Report_${empName.replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download PDF report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!selectedEmpId) {
      alert('Please select an employee first.');
      return;
    }
    setDownloading(true);
    try {
      const res = await api.get(`/reports/csv?employeeId=${selectedEmpId}&start=${dateRange.start}&end=${dateRange.end}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      const empName = employees.find(e => e._id === selectedEmpId)?.name || 'Employee';
      link.setAttribute('download', `TrackFlow_Attendance_${empName.replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download CSV report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Stats derived from fetched data
  const totalTasks      = tasks.length;
  const completedTasks  = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks    = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const completionRate  = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Tasks grouped by employee
  const tasksByEmployee = employees.map(emp => {
    const empTasks      = tasks.filter(t => t.assignedTo?._id === emp._id || t.assignedTo === emp._id);
    const empCompleted  = empTasks.filter(t => t.status === 'completed').length;
    return { ...emp, taskCount: empTasks.length, completedCount: empCompleted };
  }).filter(e => e.taskCount > 0).sort((a, b) => b.completedCount - a.completedCount);

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-slate-500">Overview of team performance and activity metrics.</p>
        </div>

        {/* Date Range + Download */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedEmpId}
            onChange={e => setSelectedEmpId(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none shadow-sm"
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
              className="bg-transparent text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
            />
            <span className="text-slate-400 text-sm">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
              className="bg-transparent text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: employees.length, icon: Users,         color: 'from-brand-500 to-purple-600' },
              { label: 'Tasks Completed', value: completedTasks,   icon: CheckCircle2,  color: 'from-emerald-500 to-teal-600' },
              { label: 'In Progress',     value: inProgressTasks,  icon: Clock,         color: 'from-blue-500 to-indigo-600' },
              { label: 'Pending',         value: pendingTasks,     icon: BarChart2,     color: 'from-amber-500 to-orange-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
                <p className="text-sm text-slate-500 font-semibold mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Task Completion Rate */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Overall Task Completion Rate</h2>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 shrink-0">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke="url(#grad)" strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${completionRate * 2.51} 251`}
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{completionRate}%</span>
                </div>
              </div>
              <div className="space-y-2 flex-1">
                {[
                  { label: 'Completed',   count: completedTasks,  color: 'bg-emerald-500' },
                  { label: 'In Progress', count: inProgressTasks, color: 'bg-blue-500' },
                  { label: 'Pending',     count: pendingTasks,    color: 'bg-amber-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${color}`} />
                    <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{label}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{count}</span>
                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: totalTasks > 0 ? `${(count / totalTasks) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Employee Performance Table */}
          {/* Desktop view: Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Employee Performance</h2>
              <p className="text-sm text-slate-500 mt-1">Tasks assigned vs completed per employee</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Employee</th>
                    <th className="px-6 py-4 font-semibold">Assigned</th>
                    <th className="px-6 py-4 font-semibold">Completed</th>
                    <th className="px-6 py-4 font-semibold">Rate</th>
                    <th className="px-6 py-4 font-semibold">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {tasksByEmployee.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                        No task data available yet.
                      </td>
                    </tr>
                  ) : tasksByEmployee.map(emp => {
                    const rate = emp.taskCount > 0 ? Math.round((emp.completedCount / emp.taskCount) * 100) : 0;
                    return (
                      <tr key={emp._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{emp.name}</p>
                              <p className="text-xs text-slate-400">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{emp.taskCount}</td>
                        <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">{emp.completedCount}</td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${rate >= 70 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-32 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-400' : 'bg-red-500'
                              }`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile view: Card List */}
          <div className="block md:hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">Employee Performance</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tasks assigned vs completed</p>
            </div>
            {tasksByEmployee.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No task data available yet.
              </div>
            ) : (
              tasksByEmployee.map(emp => {
                const rate = emp.taskCount > 0 ? Math.round((emp.completedCount / emp.taskCount) * 100) : 0;
                return (
                  <div key={emp._id} className="bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden">
                    <div className="flex items-center gap-3 justify-between pb-3 border-b border-slate-200/30 dark:border-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black ${
                        rate >= 70 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {rate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assigned Tasks</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{emp.taskCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Completed Tasks</p>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">{emp.completedCount}</p>
                      </div>

                      <div className="col-span-2 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          <span>Completion Progress</span>
                          <span>{rate}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-400' : 'bg-red-500'
                            }`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
