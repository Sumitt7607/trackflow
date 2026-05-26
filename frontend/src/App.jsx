import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LiveMapPage from './pages/LiveMapPage';
import EmployeesPage from './pages/EmployeesPage';
import GeoFencesPage from './pages/GeoFencesPage';
import TasksPage from './pages/TasksPage';
import ReportsPage from './pages/ReportsPage';
import RoutesPage from './pages/RoutesPage';
import NotificationsPage from './pages/NotificationsPage';

const PlaceholderPage = ({ title }) => (
  <div className="p-4 md:p-8">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
    <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Under Construction</h2>
      <p className="text-slate-500">This feature is currently being developed and will be available soon.</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requireAdmin && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Employee Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <EmployeeDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin={true}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/live" element={
        <ProtectedRoute requireAdmin={true}><Layout><LiveMapPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/employees" element={
        <ProtectedRoute requireAdmin={true}><Layout><EmployeesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/geofences" element={
        <ProtectedRoute requireAdmin={true}><Layout><GeoFencesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/routes" element={
        <ProtectedRoute requireAdmin={true}><Layout><RoutesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/tasks" element={
        <ProtectedRoute requireAdmin={true}><Layout><TasksPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute requireAdmin={true}><Layout><ReportsPage /></Layout></ProtectedRoute>
      } />
      
      {/* Employee extra routes */}
      <Route path="/tasks" element={
        <ProtectedRoute><Layout><TasksPage /></Layout></ProtectedRoute>
      } />
      <Route path="/routes" element={
        <ProtectedRoute><Layout><RoutesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/notifications" element={
        <ProtectedRoute requireAdmin={true}><Layout><NotificationsPage /></Layout></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
