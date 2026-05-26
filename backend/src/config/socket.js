const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LocationLog = require('../models/LocationLog');
const GeoFence = require('../models/GeoFence');
const GeoFenceViolation = require('../models/GeoFenceViolation');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Route = require('../models/Route');
const { checkGeofence, checkRouteDeviation, getDistance } = require('../utils/geofenceHelper');
const { logAudit } = require('../utils/auditLogger');

// In-memory record of active sockets: userId -> socketId
const activeSockets = new Map();

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for development
      methods: ['GET', 'POST'],
    },
  });

  // Middleware to authenticate socket connections via JWT
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Supports access token verification
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    activeSockets.set(user._id.toString(), socket.id);

    console.log(`Socket connected: User ${user.name} (${user.role}) - Socket ID: ${socket.id}`);

    // Update status to online
    if (user.role === 'employee') {
      await User.findByIdAndUpdate(user._id, { status: 'online', lastActive: new Date() });
      io.to('admins').emit('employee_status_change', {
        employeeId: user._id,
        status: 'online',
        lastActive: new Date(),
      });
    }

    // Join rooms based on role
    if (user.role === 'admin') {
      socket.join('admins');
    } else {
      socket.join(`employee_${user._id}`);
    }

    // Handle real-time GPS updates from employee
    socket.on('location_update', async (data) => {
      try {
        const { lat, lng, speed, accuracy, battery, isOfflineSync, timestamp, deviceInfo } = data;
        const employeeId = socket.user._id;

        // Fetch user data with device tracking
        const previousUser = await User.findById(employeeId);
        if (!previousUser) return;

        // GPS Spoof & Accuracy detection
        let isSpoofed = false;
        let spoofReason = '';

        if (accuracy && accuracy > 150) {
          console.warn(`GPS Update rejected: Low accuracy (${accuracy}m) for employee ${socket.user.name}`);
          return;
        }

        // Suspicious Mock location signature (some fake GPS tools output exactly 0 accuracy)
        if (accuracy !== undefined && accuracy === 0) {
          isSpoofed = true;
          spoofReason = 'Static GPS accuracy of exactly 0m (Mock GPS signature detected)';
        }

        const updateTime = timestamp ? new Date(timestamp) : new Date();
        const previousLoc = previousUser.currentLocation;

        // Velocity teleportation check: verify distance/time between points
        if (previousLoc && previousLoc.latitude && previousLoc.longitude && previousLoc.timestamp && !isSpoofed) {
          const timeDiffMs = updateTime - new Date(previousLoc.timestamp);
          const timeDiffHrs = timeDiffMs / (1000 * 60 * 60);

          if (timeDiffHrs > 0.001) { // Avoid divisions by zero or extremely tiny fractions
            const distanceKm = getDistance(
              { lat, lng },
              { lat: previousLoc.latitude, lng: previousLoc.longitude }
            );
            const calculatedSpeedKmh = distanceKm / timeDiffHrs;

            // Speed exceeding 150 km/h is impossible for field operations, check if distance > 0.5km to avoid minor GPS drift/teleport bugs
            if (calculatedSpeedKmh > 150 && distanceKm > 0.5) {
              isSpoofed = true;
              spoofReason = `Suspicious velocity jump: calculated speed of ${calculatedSpeedKmh.toFixed(1)} km/h over ${distanceKm.toFixed(2)} km`;
            }
          }
        }

        // Parse user device signature if sent
        const activeDevice = deviceInfo || previousUser.deviceInfo || { os: 'Unknown', browser: 'Unknown', deviceType: 'Mobile' };

        // 1. Create Location Log
        await LocationLog.create({
          employee: employeeId,
          latitude: lat,
          longitude: lng,
          speed: speed || 0,
          accuracy: accuracy || 0,
          batteryLevel: battery || 100,
          timestamp: updateTime,
          isOfflineSync: !!isOfflineSync,
          isSpoofed,
          spoofReason: isSpoofed ? spoofReason : undefined,
          deviceInfo: activeDevice,
        });

        // 2. Update User's Profile
        const updatedUser = await User.findByIdAndUpdate(
          employeeId,
          {
            status: 'online',
            batteryLevel: battery || 100,
            gpsAccuracy: accuracy || 0,
            lastActive: updateTime,
            deviceInfo: activeDevice,
            currentLocation: {
              latitude: lat,
              longitude: lng,
              speed: speed || 0,
              accuracy: accuracy || 0,
              timestamp: updateTime,
            },
          },
          { new: true }
        );

        // Broadcast updated coordinates to admins
        io.to('admins').emit('employee_location', {
          employeeId,
          name: updatedUser.name,
          email: updatedUser.email,
          status: 'online',
          batteryLevel: updatedUser.batteryLevel,
          gpsAccuracy: updatedUser.gpsAccuracy,
          lastActive: updatedUser.lastActive,
          deviceInfo: activeDevice,
          isSpoofed,
          spoofReason: isSpoofed ? spoofReason : undefined,
          location: {
            latitude: lat,
            longitude: lng,
            speed: speed || 0,
            accuracy: accuracy || 0,
            timestamp: updateTime,
          },
        });

        // If spoofed, trigger a security alarm, log audit, and SKIP attendance geofencing evaluation
        if (isSpoofed) {
          const spoofNotification = await Notification.create({
            recipient: null,
            sender: employeeId,
            type: 'violation',
            message: `GPS SECURITY ALARM: ${socket.user.name} suspected of GPS Spoofing! (${spoofReason})`,
            metadata: { lat, lng, employeeId, spoofReason, timestamp: updateTime },
          });
          io.to('admins').emit('admin_notification', spoofNotification);
          await logAudit('SPOOF_DETECTED', employeeId, null, { lat, lng, spoofReason });
          return; // STOP geofencing checks for fraudulent packets!
        }

        // 3. Geofence evaluation
        const geofences = await GeoFence.find({});
        let currentFenceId = null;
        let currentFence = null;

        for (const fence of geofences) {
          const isInside = checkGeofence({ lat, lng }, fence);
          if (isInside) {
            currentFenceId = fence._id;
            currentFence = fence;
            break;
          }
        }

        const todayStr = updateTime.toISOString().split('T')[0];

        // Evaluate previous geofence
        const prevFenceId = previousUser.currentLocation?.timestamp
          ? await evaluatePreviousGeofence(employeeId, { lat: previousUser.currentLocation.latitude, lng: previousUser.currentLocation.longitude })
          : null;

        const prevFenceStr = prevFenceId ? prevFenceId.toString() : null;
        const currentFenceStr = currentFenceId ? currentFenceId.toString() : null;

        if (currentFenceStr !== prevFenceStr) {
          if (currentFenceStr) {
            // Entered Geofence!
            await GeoFenceViolation.create({
              employee: employeeId,
              geoFence: currentFenceId,
              type: 'enter',
              location: { lat, lng },
              timestamp: updateTime,
            });

            await logAudit('GEOFENCE_ENTER', employeeId, null, { geofenceId: currentFenceId, name: currentFence.name, category: currentFence.category });

            // Create notification for admins
            const isRestricted = currentFence.category === 'restricted';
            const enterNotification = await Notification.create({
              recipient: null,
              sender: employeeId,
              type: isRestricted ? 'violation' : 'general',
              message: isRestricted
                ? `SECURITY BREACH: ${socket.user.name} entered RESTRICTED zone "${currentFence.name}"!`
                : `${socket.user.name} entered geofence "${currentFence.name}"`,
              metadata: { lat, lng, geofenceId: currentFenceId, employeeId, category: currentFence.category },
            });
            io.to('admins').emit('admin_notification', enterNotification);

            // Auto Check-In Logic - OFFICE ZONES ONLY
            if (currentFence.category === 'office') {
              const existingAttendance = await Attendance.findOne({ employee: employeeId, date: todayStr });
              if (!existingAttendance) {
                await Attendance.create({
                  employee: employeeId,
                  date: todayStr,
                  checkInTime: updateTime,
                  checkInMethod: 'auto',
                  geoFence: currentFenceId,
                  status: 'present',
                });

                const checkinNotify = await Notification.create({
                  recipient: null,
                  sender: employeeId,
                  type: 'general',
                  message: `Auto Check-In: ${socket.user.name} entered Office Area "${currentFence.name}"`,
                  metadata: { employeeId, geofenceId: currentFenceId },
                });
                io.to('admins').emit('admin_notification', checkinNotify);
                await logAudit('CHECK_IN', employeeId, null, { method: 'auto', geofenceId: currentFenceId });
              }
            }
          } else {
            // Exited Geofence!
            const exitedFence = geofences.find(g => g._id.toString() === prevFenceStr);
            if (exitedFence) {
              await GeoFenceViolation.create({
                employee: employeeId,
                geoFence: exitedFence._id,
                type: 'exit',
                location: { lat, lng },
                timestamp: updateTime,
              });

              await logAudit('GEOFENCE_EXIT', employeeId, null, { geofenceId: exitedFence._id, name: exitedFence.name, category: exitedFence.category });

              const isRestricted = exitedFence.category === 'restricted';
              const exitNotification = await Notification.create({
                recipient: null,
                sender: employeeId,
                type: isRestricted ? 'violation' : 'general',
                message: isRestricted
                  ? `SECURITY ALERT: ${socket.user.name} exited RESTRICTED zone "${exitedFence.name}"`
                  : `${socket.user.name} exited geofence "${exitedFence.name}"`,
                metadata: { lat, lng, geofenceId: exitedFence._id, employeeId, category: exitedFence.category },
              });
              io.to('admins').emit('admin_notification', exitNotification);

              // Auto Check-Out Logic - OFFICE ZONES ONLY
              if (exitedFence.category === 'office') {
                const attendance = await Attendance.findOne({ employee: employeeId, date: todayStr, checkOutTime: null });
                if (attendance) {
                  attendance.checkOutTime = updateTime;
                  attendance.checkOutMethod = 'auto';

                  const diffMs = updateTime - attendance.checkInTime;
                  attendance.workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                  await attendance.save();

                  const checkoutNotify = await Notification.create({
                    recipient: null,
                    sender: employeeId,
                    type: 'general',
                    message: `Auto Check-Out: ${socket.user.name} exited Office Area "${exitedFence.name}". Hours Worked: ${attendance.workingHours}`,
                    metadata: { employeeId },
                  });
                  io.to('admins').emit('admin_notification', checkoutNotify);
                  await logAudit('CHECK_OUT', employeeId, null, { method: 'auto', geofenceId: exitedFence._id, workingHours: attendance.workingHours });
                }
              }
            }
          }
        }

        // 4. Route Management & Deviation Detection
        const activeRoutes = await Route.find({
          assignedTo: employeeId,
          date: todayStr,
          status: { $in: ['pending', 'in-progress', 'deviated'] }
        });

        for (const route of activeRoutes) {
          const isDeviated = checkRouteDeviation({ lat, lng }, route.waypoints, 0.5); // 0.5km threshold
          if (isDeviated && route.status !== 'deviated') {
            route.status = 'deviated';
            await route.save();

            const devNotify = await Notification.create({
              recipient: null,
              sender: employeeId,
              type: 'violation',
              message: `Route Deviation: ${socket.user.name} has deviated from route "${route.name}"!`,
              metadata: { lat, lng, routeId: route._id, employeeId }
            });
            io.to('admins').emit('admin_notification', devNotify);
            await logAudit('ROUTE_DEVIATED', employeeId, null, { routeId: route._id, name: route.name });
          } else if (!isDeviated && route.status === 'deviated') {
            route.status = 'in-progress';
            await route.save();
          }

          let routeUpdated = false;
          for (const wp of route.waypoints) {
            if (!wp.isVisited) {
              const dist = getDistance({ lat, lng }, wp) * 1000; // in meters
              if (dist <= 100) { // Visited if within 100m range
                wp.isVisited = true;
                wp.visitedAt = updateTime;
                routeUpdated = true;

                const stopNotify = await Notification.create({
                  recipient: null,
                  sender: employeeId,
                  type: 'general',
                  message: `${socket.user.name} reached stop "${wp.address}" on route "${route.name}"`,
                  metadata: { lat, lng, routeId: route._id, waypointId: wp._id, employeeId }
                });
                io.to('admins').emit('admin_notification', stopNotify);
              }
            }
          }

          if (routeUpdated) {
            const allVisited = route.waypoints.every(wp => wp.isVisited);
            if (allVisited) {
              route.status = 'completed';
            } else if (route.status === 'pending') {
              route.status = 'in-progress';
            }
            await route.save();
            io.to('admins').emit('route_update', route);
          }
        }
      } catch (err) {
        console.error('Error handling location update socket event:', err.message);
      }
    });

    // Handle Emergency SOS alarm trigger
    socket.on('sos_alert', async (data) => {
      try {
        const { lat, lng, timestamp } = data;
        const employeeId = socket.user._id;
        const time = timestamp ? new Date(timestamp) : new Date();

        const sosNotification = await Notification.create({
          recipient: null,
          sender: employeeId,
          type: 'sos',
          message: `EMERGENCY SOS ALERT: ${socket.user.name} has triggered an SOS alarm!`,
          metadata: { lat, lng, employeeId, timestamp: time },
        });

        io.to('admins').emit('sos_notification', {
          notificationId: sosNotification._id,
          employeeId,
          name: socket.user.name,
          message: sosNotification.message,
          location: { lat, lng },
          timestamp: time,
        });

        await logAudit('SOS_TRIGGERED', employeeId, null, { lat, lng });
        console.log(`SOS Alert triggered by ${socket.user.name}`);
      } catch (err) {
        console.error('Error handling SOS alert socket event:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: User ${user.name} - Socket ID: ${socket.id}`);
      activeSockets.delete(user._id.toString());

      if (user.role === 'employee') {
        const updatedTime = new Date();
        await User.findByIdAndUpdate(user._id, { status: 'offline', lastActive: updatedTime });
        io.to('admins').emit('employee_status_change', {
          employeeId: user._id,
          status: 'offline',
          lastActive: updatedTime,
        });
      }
    });
  });

  return io;
};

const evaluatePreviousGeofence = async (employeeId, location) => {
  const geofences = await GeoFence.find({});
  for (const fence of geofences) {
    if (checkGeofence(location, fence)) {
      return fence._id;
    }
  }
  return null;
};

module.exports = { initializeSocket, activeSockets };
