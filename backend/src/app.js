const express = require('express');
const cors = require('cors');
const path = require('path');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const geofenceRoutes = require('./routes/geofences');
const attendanceRoutes = require('./routes/attendance');
const taskRoutes = require('./routes/tasks');
const reportRoutes = require('./routes/reports');
const routeRoutes = require('./routes/routes');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/auditLogs');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API requests
app.use('/api/', apiLimiter);

// Serve uploads static folder
// On Vercel, only /tmp is writable, so serve from /tmp/uploads in production
const uploadsDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);

// Base route for connectivity check
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to TrackFlow API server' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
