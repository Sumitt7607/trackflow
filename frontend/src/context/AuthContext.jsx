import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('trackflow_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('trackflow_token') || null);
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        localStorage.setItem('trackflow_user', JSON.stringify(data.user));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, []);

  const login = useCallback(async (email, password) => {
    // Simple device fingerprinting
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'Desktop';

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android') || userAgent.includes('iPhone')) {
      os = userAgent.includes('Android') ? 'Android' : 'iOS';
      deviceType = 'Mobile';
    }

    const deviceInfo = { os, browser, deviceType };

    const { data } = await api.post('/auth/login', { email, password, deviceInfo });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('trackflow_token', data.token);
    localStorage.setItem('trackflow_refresh', data.refreshToken);
    localStorage.setItem('trackflow_user', JSON.stringify(data.user));
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('trackflow_token', data.token);
    localStorage.setItem('trackflow_refresh', data.refreshToken);
    localStorage.setItem('trackflow_user', JSON.stringify(data.user));
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('trackflow_refresh');
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      console.warn('API logout endpoint failed, proceeding with local clear:', err.message);
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('trackflow_token');
    localStorage.removeItem('trackflow_refresh');
    localStorage.removeItem('trackflow_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
