const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
    },
    checkInMethod: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual',
    },
    checkOutMethod: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'on-duty'],
      default: 'on-duty',
    },
    workingHours: {
      type: Number, // in hours
      default: 0,
    },
    geoFence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeoFence',
    },
    manualOverrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    manualOverrideReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying unique daily attendance per employee
AttendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
