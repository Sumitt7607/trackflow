const mongoose = require('mongoose');

const LocationLogSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    speed: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    batteryLevel: {
      type: Number,
      default: 100,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isOfflineSync: {
      type: Boolean,
      default: false,
    },
    isSpoofed: {
      type: Boolean,
      default: false,
      index: true,
    },
    spoofReason: {
      type: String,
    },
    deviceInfo: {
      os: String,
      browser: String,
      deviceType: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for query optimization (route queries by employee and time range)
LocationLogSchema.index({ employee: 1, timestamp: -1 });

module.exports = mongoose.model('LocationLog', LocationLogSchema);
