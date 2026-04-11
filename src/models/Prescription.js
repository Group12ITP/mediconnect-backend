// models/Prescription.js
const mongoose = require('mongoose');

/**
 * Medicine Sub-schema
 */
const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    dosage: { type: String, trim: true },
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },

    // Pharmacy Finder Fields
    rxcui: { type: String, trim: true, index: true },
    genericName: { type: String, trim: true },
    brandName: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 1, min: 1 },
    strength: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

/**
 * Main Prescription Schema
 */
const prescriptionSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },

    // Proper Patient Reference (NEW + IMPORTANT)
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
    },

    // Backward compatibility fields
    patientId: {   // Keep if you use custom patientId like PAT-001
      type: String,
      index: true,
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      index: true,
    },
    patientAge: { type: Number, min: 0, max: 150 },
    patientGender: { type: String, enum: ['Male', 'Female', 'Other'] },
    patientBloodGroup: {
      type: String,
      uppercase: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: '',
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientAppointment',   // Use your actual appointment model
      default: null,
    },

    medicines: {
      type: [medicineSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one medicine is required',
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },
    signatureData: { type: String, default: null },

    prescriptionId: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'dispensed'],
      default: 'active',
      index: true,
    },

    issuedAt: { type: Date, default: Date.now, index: true },
    validUntil: { type: Date, default: null },

    // Dispensing Info
    dispensedAt: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', default: null },
    dispensedOn: { type: Date, default: null },
    dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacist', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ====================== INDEXES ======================
prescriptionSchema.index({ doctor: 1, issuedAt: -1 });
prescriptionSchema.index({ patient: 1, status: 1 });
prescriptionSchema.index({ patientId: 1, status: 1 });
prescriptionSchema.index({ prescriptionId: 1 }, { unique: true });
prescriptionSchema.index({ 'medicines.rxcui': 1 });
prescriptionSchema.index({ status: 1, validUntil: 1 });

// ====================== PRE-SAVE ======================
prescriptionSchema.pre('save', async function () {
  if (!this.prescriptionId) {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.prescriptionId = `RX-${ymd}-${rand}`;
  }

  if (this.validUntil && this.validUntil < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
});

// ====================== SAFE MODEL REGISTRATION ======================
const Prescription = mongoose.models.Prescription || mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;