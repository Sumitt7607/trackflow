const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a route name'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    assignedTo: {
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
    waypoints: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String, required: true },
        isVisited: { type: Boolean, default: false },
        visitedAt: { type: Date },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'deviated'],
      default: 'pending',
    },
    distance: {
      type: Number, // In Kilometers
      default: 0,
    },
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

module.exports = mongoose.model('Route', RouteSchema);
