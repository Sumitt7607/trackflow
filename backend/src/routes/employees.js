const express = require('express');
const User = require('../models/User');
const LocationLog = require('../models/LocationLog');
const GeoFenceViolation = require('../models/GeoFenceViolation');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes here are admin only
router.use(protect);
router.use(authorize('admin'));

// @desc    Get all employees with latest details
// @route   GET /api/employees
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new employee (Admin only)
// @route   POST /api/employees
// @access  Private/Admin
router.post('/', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }
    const employee = await User.create({ name, email, password, role: 'employee' });
    res.status(201).json({
      success: true,
      data: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        status: employee.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete an employee (Admin only)
// @route   DELETE /api/employees/:id
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    const employee = await User.findOneAndDelete({ _id: req.params.id, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, message: 'Employee removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @desc    Get specific employee details
// @route   GET /api/employees/:id
// @access  Private/Admin
router.get('/:id', async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' }).select('-password');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get route history for coordinate playback/heatmap
// @route   GET /api/employees/:id/history
// @access  Private/Admin
router.get('/:id/history', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Set query dates (default to today)
    const startDate = start ? new Date(start) : new Date();
    if (!start) startDate.setHours(0, 0, 0, 0);

    const endDate = end ? new Date(end) : new Date();
    if (!end) endDate.setHours(23, 59, 59, 999);

    const logs = await LocationLog.find({
      employee: req.params.id,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: 1 }); // Sort chronologically for path animation

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get geofence violations for specific employee
// @route   GET /api/employees/:id/violations
// @access  Private/Admin
router.get('/:id/violations', async (req, res) => {
  try {
    const violations = await GeoFenceViolation.find({ employee: req.params.id })
      .populate('geoFence', 'name type')
      .sort({ timestamp: -1 });

    res.json({ success: true, count: violations.length, data: violations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
