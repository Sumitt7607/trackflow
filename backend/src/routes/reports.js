const express = require('express');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const GeoFenceViolation = require('../models/GeoFenceViolation');
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/auth');
const { generateEmployeeReportPDF } = require('../utils/pdfGenerator');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

// @desc    Download PDF report for employee
// @route   GET /api/reports/pdf
// @access  Private/Admin
router.get('/pdf', async (req, res) => {
  try {
    const { employeeId, start, end } = req.query;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Please provide employeeId' });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const startDate = start ? new Date(start) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = end ? new Date(end) : new Date();

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Gather records
    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      date: { $gte: startStr, $lte: endStr },
    }).sort({ date: -1 });

    const violations = await GeoFenceViolation.find({
      employee: employeeId,
      timestamp: { $gte: startDate, $lte: endDate },
    }).populate('geoFence', 'name').sort({ timestamp: -1 });

    const tasks = await Task.find({
      assignedTo: employeeId,
      date: { $gte: startStr, $lte: endStr },
    }).sort({ date: -1 });

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=TrackFlow-Report-${employee.name.replace(/\s+/g, '_')}-${startStr}-to-${endStr}.pdf`
    );

    // Call PDF Generator
    generateEmployeeReportPDF(
      {
        employee,
        attendanceRecords,
        violations,
        tasks,
        dateRange: { start: startStr, end: endStr },
      },
      res
    );
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Download CSV report for employee
// @route   GET /api/reports/csv
// @access  Private/Admin
router.get('/csv', async (req, res) => {
  try {
    const { employeeId, start, end } = req.query;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Please provide employeeId' });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const startDate = start ? new Date(start) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = end ? new Date(end) : new Date();

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: startStr, $lte: endStr },
    }).sort({ date: -1 });

    // Prepare CSV rows
    const headers = ['Date', 'Check In Time', 'Check Out Time', 'Check In Method', 'Check Out Method', 'Status', 'Working Hours'];
    const rows = records.map((r) => [
      r.date,
      r.checkInTime ? new Date(r.checkInTime).toLocaleString() : '',
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : '',
      r.checkInMethod,
      r.checkOutMethod || '',
      r.status,
      r.workingHours || 0,
    ]);

    const headerLine = headers.join(',');
    const rowLines = rows.map((row) =>
      row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headerLine, ...rowLines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=TrackFlow-Report-${employee.name.replace(/\s+/g, '_')}-${startStr}-to-${endStr}.csv`
    );

    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
