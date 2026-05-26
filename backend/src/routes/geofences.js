const express = require('express');
const GeoFence = require('../models/GeoFence');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all geofences is allowed for logged in users (both employees & admins need it)
router.get('/', protect, async (req, res) => {
  try {
    const fences = await GeoFence.find({}).populate('createdBy', 'name');
    res.json({ success: true, count: fences.length, data: fences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin-only endpoints below
router.use(protect);
router.use(authorize('admin'));

// @desc    Create a geofence
// @route   POST /api/geofences
// @access  Private/Admin
router.post('/', async (req, res) => {
  try {
    const { name, description, type, circleCenter, radius, polygonCoordinates } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Please provide name and type' });
    }

    if (type === 'circle' && (!circleCenter || !radius)) {
      return res.status(400).json({ success: false, message: 'Please provide circleCenter and radius' });
    }

    if (type === 'polygon' && (!polygonCoordinates || polygonCoordinates.length < 3)) {
      return res.status(400).json({ success: false, message: 'Polygons require at least 3 coordinates' });
    }

    const fence = await GeoFence.create({
      name,
      description,
      type,
      circleCenter,
      radius,
      polygonCoordinates,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: fence });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Geofence name must be unique' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a geofence
// @route   DELETE /api/geofences/:id
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    const fence = await GeoFence.findById(req.params.id);
    if (!fence) {
      return res.status(404).json({ success: false, message: 'Geofence not found' });
    }

    await fence.deleteOne();
    res.json({ success: true, message: 'Geofence deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
