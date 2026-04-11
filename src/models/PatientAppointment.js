// models/PatientAppointment.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const patientAppointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required'],
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    time: {
      type: String, // 'HH:MM'
      required: [true, 'Time is required'],
      match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'],
    },
    specialty: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Video', 'Clinic', 'Phone'],
      default: 'Video',
    },
    reason: {
      type: String,
      trim: true,
    },
    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    // Stripe payment
    stripeSessionId: {
      type: String,
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    stripeReceiptUrl: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
    },
    // Appointment lifecycle
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
    },
    // Jitsi room ID — generated when doctor confirms
    videoRoomId: {
      type: String,
      default: null,
    },
    doctorNotes: {
      type: String,
      trim: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    // Human-readable appointment ID
    appointmentId: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate appointmentId using async middleware (Fixed)
patientAppointmentSchema.pre('save', async function () {
  // Only generate if appointmentId is not already set
  if (!this.appointmentId) {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    // Generate a short random string (4-6 characters)
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    this.appointmentId = `APPT-${ymd}-${rand}`;
  }
});

// Optional: Add a pre-validate hook to ensure appointmentId is always generated
patientAppointmentSchema.pre('validate', async function () {
  if (!this.appointmentId) {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.appointmentId = `APPT-${ymd}-${rand}`;
  }
});

// Indexes for better query performance
patientAppointmentSchema.index({ patient: 1, status: 1 });
patientAppointmentSchema.index({ doctor: 1, status: 1 });
patientAppointmentSchema.index({ doctor: 1, date: 1, time: 1 });
patientAppointmentSchema.index({ stripeSessionId: 1 }, { sparse: true });
patientAppointmentSchema.index({ appointmentId: 1 }, { unique: true });

module.exports = mongoose.model('PatientAppointment', patientAppointmentSchema);