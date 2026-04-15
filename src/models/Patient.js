// models/Patient.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper function to format phone number to E.164
const formatToE164 = (phoneNumber) => {
  if (!phoneNumber) return '';

  // Remove all non-digit characters
  let cleaned = phoneNumber.toString().replace(/\D/g, '');

  if (!cleaned) return '';

  // Sri Lanka format: 0XX XXXXXXX → +94XX XXXXXXX
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = '94' + cleaned.substring(1);
  }

  // Add + prefix if not present
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

// ====================== SCHEMA ======================
const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^\+\d{10,15}$/.test(v);
        },
        message: 'Phone number must be in E.164 format (e.g., +94771234567)',
      },
    },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: '',
    },
    address: { type: String, trim: true },
    medicalConditions: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ====================== MIDDLEWARE ======================

// Password hashing (async - correct modern style)
patientSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Phone number formatting (use 'pre' save instead of validate to avoid 'next' issues)
patientSchema.pre('save', function () {
  if (this.phoneNumber) {
    this.phoneNumber = formatToE164(this.phoneNumber);
  }
});

// ====================== METHODS ======================
patientSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, role: 'patient' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

patientSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual age
patientSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

// ====================== SAFE MODEL REGISTRATION ======================
const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);

module.exports = Patient;