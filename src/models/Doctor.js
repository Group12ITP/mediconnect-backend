// models/Doctor.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ====================== SCHEMA ======================
const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    specialization: {
      type: String,
      required: [true, "Please add specialization"],
      enum: [
        "Cardiology", "Neurology", "Pediatrics", "Orthopedics", "Dermatology",
        "Ophthalmology", "Psychiatry", "Radiology", "Surgery", "Internal Medicine",
        "Emergency Medicine", "Family Medicine", "Other"
      ],
    },
    licenseNumber: {
      type: String,
      required: [true, "Please add license number"],
      unique: true,
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, "Please add qualification"],
      trim: true,
    },
    experience: {
      type: Number,
      required: [true, "Please add years of experience"],
      min: [0, "Experience cannot be negative"],
      max: [60, "Experience cannot exceed 60 years"],
    },
    hospital: {
      type: String,
      required: [true, "Please add hospital/clinic name"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Please add phone number"],
      match: [/^\+?[\d\s-]{10,}$/, "Please add a valid phone number"],
    },

    // ── Extended profile fields (optional, editable by doctor) ──
    bio: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    consultationFee: { type: Number, default: 0, min: 0 },
    education: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    languages: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ====================== PASSWORD HASHING ======================
doctorSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(
      parseInt(process.env.BCRYPT_ROUNDS) || 10
    );
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// ====================== METHODS ======================
doctorSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, role: "doctor" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

doctorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual doctorCode
doctorSchema.virtual("doctorCode").get(function () {
  return `DOC${this._id.toString().slice(-6).toUpperCase()}`;
});

// ====================== SAFE MODEL REGISTRATION ======================
const Doctor = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;