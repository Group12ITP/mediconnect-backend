// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    time: {
      type: String, // 'HH:MM'
      required: [true, 'Time is required'],
      match: [/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'],
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    patientAge: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age seems unrealistic'],
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Video', 'Clinic', 'Phone'],
      default: 'Video',
    },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'cancelled', 'completed'],
      default: 'confirmed',
    },
    duration: {
      type: Number, // in minutes
      default: 30,
      min: [5, 'Duration must be at least 5 minutes'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups by doctor + date
appointmentSchema.index({ doctor: 1, date: 1 });
// Index for fast lookups by doctor + status
appointmentSchema.index({ doctor: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
