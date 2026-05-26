const mongoose = require('mongoose');

const GeoFenceViolationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    geoFence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeoFence',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['enter', 'exit'],
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GeoFenceViolation', GeoFenceViolationSchema);
