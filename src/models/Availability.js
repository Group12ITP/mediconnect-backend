// models/Availability.js
const mongoose = require('mongoose');

/**
 * Represents a single time slot within a date's availability block.
 * maxPatients controls patient capacity for that slot.
 */
const timeSlotSchema = new mongoose.Schema(
  {
    time: {
      type: String,
      required: [true, 'Time is required'],
      match: [/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'],
    },
    maxPatients: {
      type: Number,
      required: true,
      min: [1, 'Max patients must be at least 1'],
      max: [50, 'Max patients cannot exceed 50'],
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/**
 * Availability document: one document per doctor per date.
 * Contains an array of time slots and overall active/inactive status.
 */
const availabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
    },
    date: {
      type: String, // stored as 'YYYY-MM-DD' for easy querying
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    slots: {
      type: [timeSlotSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index — one availability document per doctor per date
availabilitySchema.index({ doctor: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Availability', availabilitySchema);
