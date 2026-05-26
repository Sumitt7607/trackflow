import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [employeeLocations, setEmployeeLocations] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Admin listeners
    if (user.role === 'admin') {
      socket.on('employee_location', (data) => {
        setEmployeeLocations((prev) => ({ ...prev, [data.employeeId]: data }));
      });

      socket.on('employee_status_change', (data) => {
        setEmployeeLocations((prev) => {
          if (!prev[data.employeeId]) return prev;
          return { ...prev, [data.employeeId]: { ...prev[data.employeeId], ...data } };
        });
      });

      socket.on('admin_notification', (notif) => {
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
      });

      socket.on('sos_notification', (alert) => {
        setSosAlerts((prev) => [alert, ...prev]);
        // Play audio alert
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        } catch (_) {}
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user]);

  const sendLocationUpdate = (locationData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('location_update', locationData);
      return true;
    }
    return false;
  };

  const sendSOS = (lat, lng) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sos_alert', { lat, lng, timestamp: new Date().toISOString() });
    }
  };

  const dismissSOS = (employeeId) => {
    setSosAlerts((prev) => prev.filter((a) => a.employeeId !== employeeId));
  };

  const clearNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      employeeLocations,
      notifications,
      sosAlerts,
      sendLocationUpdate,
      sendSOS,
      dismissSOS,
      clearNotification,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
};
