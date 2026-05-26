const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { employeeId, start, end } = req.query;
    const query = {};

    // Filter by employee
    if (req.user.role === 'admin') {
      if (employeeId) {
        query.employee = employeeId;
      }
    } else {
      query.employee = req.user.id;
    }

    // Filter by date range (YYYY-MM-DD)
    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = start;
      if (end) query.date.$lte = end;
    }

    const records = await Attendance.find(query)
      .populate('employee', 'name email')
      .populate('geoFence', 'name')
      .populate('manualOverrideBy', 'name')
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Manual Check-In
// @route   POST /api/attendance/check-in
// @access  Private
router.post('/check-in', async (req, res) => {
  try {
    const employeeId = req.user.id;
    const now = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check if check-in already exists
    let record = await Attendance.findOne({ employee: employeeId, date: todayStr });
    if (record) {
      return res.status(400).json({ success: false, message: 'Already checked in for today' });
    }

    record = await Attendance.create({
      employee: employeeId,
      date: todayStr,
      checkInTime: now,
      checkInMethod: req.body.timestamp ? 'auto' : 'manual', // Automatically synced offline events count as auto
      status: 'present',
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Manual Check-Out
// @route   POST /api/attendance/check-out
// @access  Private
router.post('/check-out', async (req, res) => {
  try {
    const employeeId = req.user.id;
    const now = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    const todayStr = now.toISOString().split('T')[0];

    let record = await Attendance.findOne({ employee: employeeId, date: todayStr });
    if (!record) {
      return res.status(400).json({ success: false, message: 'Must check in first before checking out' });
    }

    if (record.checkOutTime) {
      return res.status(400).json({ success: false, message: 'Already checked out for today' });
    }

    record.checkOutTime = now;
    record.checkOutMethod = req.body.timestamp ? 'auto' : 'manual';

    // Calculate hours worked
    const diffMs = now - record.checkInTime;
    record.workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    await record.save();

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Admin Attendance Override
// @route   POST /api/attendance/override
// @access  Private/Admin
router.post('/override', authorize('admin'), async (req, res) => {
  try {
    const { employeeId, date, checkInTime, checkOutTime, status, reason } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Please provide employeeId, date and status' });
    }

    let record = await Attendance.findOne({ employee: employeeId, date });

    const checkInDate = checkInTime ? new Date(checkInTime) : new Date(`${date}T09:00:00`);
    const checkOutDate = checkOutTime ? new Date(checkOutTime) : null;

    let workingHours = 0;
    if (checkInDate && checkOutDate) {
      const diffMs = checkOutDate - checkInDate;
      workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    }

    if (record) {
      record.checkInTime = checkInDate;
      record.checkOutTime = checkOutDate;
      record.status = status;
      record.workingHours = workingHours;
      record.manualOverrideBy = req.user.id;
      record.manualOverrideReason = reason || 'Admin manual correction';
      await record.save();
    } else {
      record = await Attendance.create({
        employee: employeeId,
        date,
        checkInTime: checkInDate,
        checkOutTime: checkOutDate,
        status,
        workingHours,
        checkInMethod: 'manual',
        checkOutMethod: 'manual',
        manualOverrideBy: req.user.id,
        manualOverrideReason: reason || 'Admin manual entry',
      });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
