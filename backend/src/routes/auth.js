const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secretkey', {
    expiresIn: '15m', // Access token expires in 15 minutes
  });
};

const generateRefreshToken = async (userId) => {
  const tokenStr = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || 'refreshsecretkey', {
    expiresIn: '30d',
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Store refresh token database-side
  await RefreshToken.create({
    user: userId,
    token: tokenStr,
    expiresAt,
  });

  return tokenStr;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    // Log the registration event
    await logAudit('REGISTER', user._id, req, { name: user.name, role: user.role });

    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;

    // Get user with password included
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      const accessToken = generateAccessToken(user._id);
      const refreshToken = await generateRefreshToken(user._id);

      // Save client device info if provided
      if (deviceInfo) {
        user.deviceInfo = deviceInfo;
        await user.save();
      }

      // Log the login event
      await logAudit('LOGIN', user._id, req, { email: user.email, role: user.role, deviceInfo });

      res.json({
        success: true,
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    // Verify token exists in database
    const dbToken = await RefreshToken.findOne({ token: refreshToken });
    if (!dbToken) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked refresh token' });
    }

    // Verify signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refreshsecretkey');
    } catch (err) {
      // Token expired or invalid signature, delete from DB
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ success: false, message: 'Refresh token expired or invalid' });
    }

    // Verify user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Rotate tokens
    await RefreshToken.deleteOne({ token: refreshToken });
    
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = await generateRefreshToken(user._id);

    res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Log out & revoke refresh token
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    } else {
      // Revoke all tokens if specific one not provided
      await RefreshToken.deleteMany({ user: req.user.id });
    }

    // Log the logout event
    await logAudit('LOGOUT', req.user.id, req, { email: req.user.email });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          batteryLevel: user.batteryLevel,
          internetStatus: user.internetStatus,
          gpsAccuracy: user.gpsAccuracy,
          deviceInfo: user.deviceInfo,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
