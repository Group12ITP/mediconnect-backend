const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    // ── Pharmacy Reference ──────────────────────────────────────
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
    },
    pharmacyId: {
      type: String,
      required: true,
      index: true,
    },

    // ── Medicine Identity ───────────────────────────────────────
    // rxcui is RxNorm's unique concept identifier for a medicine
    // e.g. "161" for Acetaminophen — used for cross-pharmacy lookup
    rxcui: {
      type: String,
      required: [true, "RxNorm RXCUI is required"],
      trim: true,
    },
    genericName: {
      type: String,
      required: [true, "Generic medicine name is required"],
      trim: true,
    },
    brandName: {
      type: String,
      trim: true,
      default: "",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },
    dosageForm: {
      // e.g. Tablet, Capsule, Syrup, Injection, Cream
      type: String,
      trim: true,
      default: "",
    },
    strength: {
      // e.g. "500mg", "250mg/5ml"
      type: String,
      trim: true,
      default: "",
    },

    // ── Stock ───────────────────────────────────────────────────
    quantityInStock: {
      type: Number,
      required: [true, "Quantity in stock is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    unit: {
      // e.g. "tablets", "bottles", "vials", "tubes"
      type: String,
      trim: true,
      default: "units",
    },
    reorderLevel: {
      // Alert when stock falls below this
      type: Number,
      default: 10,
      min: 0,
    },

    // ── Pricing ─────────────────────────────────────────────────
    pricePerUnit: {
      type: Number,
      required: [true, "Price per unit is required"],
      min: [0, "Price cannot be negative"],
    },
    currency: {
      type: String,
      default: "LKR",
      uppercase: true,
      trim: true,
    },

    // ── Availability ────────────────────────────────────────────
    isAvailable: {
      type: Boolean,
      default: true,
    },
    requiresPrescription: {
      type: Boolean,
      default: true,
    },

    // ── Expiry ──────────────────────────────────────────────────
    expiryDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Compound unique index: one entry per medicine per pharmacy ──
inventorySchema.index({ pharmacy: 1, rxcui: 1 }, { unique: true });

// ── Indexes for pharmacy finder queries ─────────────────────────
inventorySchema.index({ rxcui: 1, isAvailable: 1 });
inventorySchema.index({ pharmacyId: 1, isAvailable: 1 });
inventorySchema.index({ genericName: "text", brandName: "text" });

// ── Virtual: low stock flag ─────────────────────────────────────
inventorySchema.virtual("isLowStock").get(function () {
  return this.quantityInStock <= this.reorderLevel;
});

// ── Virtual: is expired ─────────────────────────────────────────
inventorySchema.virtual("isExpired").get(function () {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

module.exports = mongoose.model("Inventory", inventorySchema);