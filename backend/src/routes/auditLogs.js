const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Restrict all audit logs strictly to administrators
router.use(protect);
router.use(authorize('admin'));

// @desc    Get system audit logs
// @route   GET /api/audit-logs
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const { action, performedBy } = req.query;
    const query = {};

    if (action) query.action = action;
    if (performedBy) query.performedBy = performedBy;

    const logs = await AuditLog.find(query)
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(100); // Retrieve the last 100 entries to prevent overload

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
