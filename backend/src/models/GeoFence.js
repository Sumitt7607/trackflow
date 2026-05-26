const mongoose = require('mongoose');

const GeoFenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a geofence name'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['circle', 'polygon'],
      required: true,
    },
    category: {
      type: String,
      enum: ['office', 'restricted', 'regular'],
      default: 'regular',
      index: true,
    },
    circleCenter: {
      lat: Number,
      lng: Number,
    },
    radius: {
      type: Number, // In meters
      default: 0,
    },
    polygonCoordinates: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GeoFence', GeoFenceSchema);
