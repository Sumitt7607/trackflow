const express = require('express');
const Route = require('../models/Route');
const { protect, authorize } = require('../middleware/auth');
const turf = require('@turf/turf');

const router = express.Router();

router.use(protect);

// @desc    Optimize route waypoints using Nearest Neighbor TSP algorithm
// @route   POST /api/routes/optimize
// @access  Private/Admin
router.post('/optimize', authorize('admin'), async (req, res) => {
  try {
    const { waypoints } = req.body;

    if (!waypoints || waypoints.length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide at least 2 waypoints to optimize' });
    }

    const unvisited = [...waypoints];
    const optimized = [unvisited.shift()]; // Start with the first waypoint as anchor

    let current = optimized[0];
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const from = turf.point([current.lng, current.lat]);
        const to = turf.point([unvisited[i].lng, unvisited[i].lat]);
        const dist = turf.distance(from, to, { units: 'kilometers' });

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestIndex = i;
        }
      }

      totalDistance += nearestDistance;
      current = unvisited.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    res.json({
      success: true,
      data: optimized,
      distance: Math.round(totalDistance * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get routes list
// @route   GET /api/routes
// @access  Private
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin') {
      query.assignedTo = req.user.id;
    }

    const routes = await Route.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: routes.length, data: routes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get specific route
// @route   GET /api/routes/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name');

    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    // Verify access
    if (req.user.role !== 'admin' && route.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this route' });
    }

    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a route assignment (Admin only)
// @route   POST /api/routes
// @access  Private/Admin
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, description, assignedTo, date, waypoints } = req.body;

    if (!name || !assignedTo || !date || !waypoints || waypoints.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, assignedTo, date, and at least one waypoint',
      });
    }

    // Calculate cumulative distance between waypoints using Turf.js
    let distance = 0;
    if (waypoints.length > 1) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const from = turf.point([waypoints[i].lng, waypoints[i].lat]);
        const to = turf.point([waypoints[i + 1].lng, waypoints[i + 1].lat]);
        distance += turf.distance(from, to, { units: 'kilometers' });
      }
    }
    distance = Math.round(distance * 100) / 100; // Round to 2 decimals

    const route = await Route.create({
      name,
      description,
      assignedTo,
      date,
      waypoints,
      distance,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update route (status or check in stops)
// @route   PUT /api/routes/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    // Verify access
    if (req.user.role !== 'admin' && route.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this route' });
    }

    const { status, waypointId, isVisited } = req.body;

    if (status) {
      route.status = status;
    }

    // Handle marking a stop/waypoint as visited
    if (waypointId) {
      const waypoint = route.waypoints.id(waypointId);
      if (waypoint) {
        waypoint.isVisited = isVisited !== undefined ? isVisited : true;
        if (waypoint.isVisited) {
          waypoint.visitedAt = new Date();
        } else {
          waypoint.visitedAt = undefined;
        }
      }
    }

    // Auto complete route if all waypoints are visited
    const allVisited = route.waypoints.every((wp) => wp.isVisited);
    if (allVisited && route.waypoints.length > 0) {
      route.status = 'completed';
    }

    await route.save();

    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete route assignment (Admin only)
// @route   DELETE /api/routes/:id
// @access  Private/Admin
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    await route.deleteOne();
    res.json({ success: true, message: 'Route assignment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
