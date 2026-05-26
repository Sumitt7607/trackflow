const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Helper to build the query for the current user
const buildQuery = (user, extraFilters = {}) =>
  user.role === 'admin'
    ? { $or: [{ recipient: user.id }, { recipient: null }], ...extraFilters }
    : { recipient: user.id, ...extraFilters };

// @desc    Get notifications for current user
// @route   GET /api/notifications
// @access  Private
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find(buildQuery(req.user))
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments(buildQuery(req.user, { read: false }));
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mark ALL notifications as read  (MUST be before /:id routes)
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      buildQuery(req.user, { read: false }),
      { $set: { read: true } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete all READ notifications  (MUST be before /:id routes)
// @route   DELETE /api/notifications/clear-read
// @access  Private
router.delete('/clear-read', async (req, res) => {
  try {
    const result = await Notification.deleteMany(buildQuery(req.user, { read: true }));
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    notif.read = true;
    await notif.save();
    res.json({ success: true, data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a single notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
