const mongoose = require("mongoose");
const Counter = require("./Counter");

// ── Operating Hours Sub-schema ──────────────────────────────────
const operatingHoursSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // 0 = Sunday
      max: 6, // 6 = Saturday
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    openTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "openTime must be HH:MM (24hr)"],
      default: "08:00",
    },
    closeTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "closeTime must be HH:MM (24hr)"],
      default: "20:00",
    },
  },
  { _id: true }
);

// ── Main Pharmacy Schema ────────────────────────────────────────
const pharmacySchema = new mongoose.Schema(
  {
    // ── Auto-Generated Pharmacy ID ──────────────────────────────
    pharmacyId: {
      type: String,
      unique: true,
      index: true,
    },

    // ── Linked Pharmacist ───────────────────────────────────────
    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      required: true,
      unique: true, // One pharmacy per pharmacist
    },
    pharmacistId: {
      type: String,
      required: true,
      index: true,
    },

    // ── Basic Info ──────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Pharmacy name is required"],
      trim: true,
      maxlength: [200, "Pharmacy name cannot exceed 200 characters"],
    },
    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Address ─────────────────────────────────────────────────
    address: {
      street:   { type: String, trim: true, required: [true, "Street address is required"] },
      city:     { type: String, trim: true, required: [true, "City is required"] },
      district: { type: String, trim: true, default: "" },
      province: { type: String, trim: true, default: "" },
      country:  { type: String, trim: true, default: "Sri Lanka" },
      postalCode:{ type: String, trim: true, default: "" },
    },

    // ── GeoJSON Location (auto-set by Google Maps geocoding) ────
    // Required for $nearSphere / 2dsphere queries in pharmacy finder
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude] — GeoJSON order
        default: [0, 0],
      },
    },

    // ── Human-readable lat/lng (for frontend map display) ───────
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null },

    // ── Google Maps Place ID (for deep map linking) ─────────────
    googlePlaceId: {
      type: String,
      default: "",
    },

    // ── Operating Hours ─────────────────────────────────────────
    operatingHours: {
      type: [operatingHoursSchema],
      default: [],
    },
    is24Hours: {
      type: Boolean,
      default: false,
    },

    // ── Status ──────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false, // Admin verifies the pharmacy
    },

    // ── Description ─────────────────────────────────────────────
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // ── Rating (populated by reviews in future) ─────────────────
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Pre-save: Generate pharmacyId ──────────────────────────────
pharmacySchema.pre("save", async function () {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      "pharmacyId",
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true }
    );
    const padded = String(counter.seq).padStart(3, "0");
    this.pharmacyId = `PHARM-${padded}`;
  }
});

// ── 2dsphere index for geospatial queries ───────────────────────
// CRITICAL: Must exist for $nearSphere queries in pharmacy finder
pharmacySchema.index({ location: "2dsphere" });
pharmacySchema.index({ pharmacyId: 1 });
pharmacySchema.index({ "address.city": 1 });

module.exports = mongoose.model("Pharmacy", pharmacySchema);