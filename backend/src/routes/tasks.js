const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
// On Vercel, only /tmp is writable. Use /tmp/uploads in production.
const uploadDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `task-${req.params.id || 'upload'}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) are allowed'));
  },
});

router.use(protect);

// @desc    Get tasks list
// @route   GET /api/tasks
// @access  Private
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin') {
      query.assignedTo = req.user.id;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a task (Admin only)
// @route   POST /api/tasks
// @access  Private/Admin
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { title, description, assignedTo, date } = req.body;

    if (!title || !assignedTo || !date) {
      return res.status(400).json({ success: false, message: 'Please provide title, assignedTo, and date' });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      date,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update task status, notes, and photos from field (Employee only)
// @route   PUT /api/tasks/:id
// @access  Private/Employee
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Ensure employee is updating their own task
    if (req.user.role !== 'admin' && task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot update other employee\'s tasks' });
    }

    const { status, notes, latitude, longitude, accuracy } = req.body;

    if (status) task.status = status;
    if (notes) task.notes = notes;
    
    if (req.file) {
      // Store relative path so frontend can fetch it easily
      task.photoUrl = `/uploads/${req.file.filename}`;
    }

    // Save GPS proof fields
    if (latitude !== undefined) task.latitude = parseFloat(latitude);
    if (longitude !== undefined) task.longitude = parseFloat(longitude);
    if (accuracy !== undefined) task.accuracy = parseFloat(accuracy);

    if (status === 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
