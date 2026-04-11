const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Counter = require("./Counter");

const pharmacistSchema = new mongoose.Schema(
  {
    // ── Auto-Generated Pharmacist ID ────────────────────────────
    pharmacistId: {
      type: String,
      unique: true,
      index: true,
    },

    // ── Basic Info ──────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    // ── Role & Status ───────────────────────────────────────────
    role: {
      type: String,
      default: "pharmacist",
      immutable: true,
    },
    isApproved: {
      type: Boolean,
      default: false, // Admin must approve
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Professional Info ───────────────────────────────────────
    licenseNumber: {
      type: String,
      required: [true, "Pharmacy license number is required"],
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    // ── Linked Pharmacy (set after pharmacy profile is created) ─
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      default: null,
    },

    // ── Token Versioning (logout all devices) ───────────────────
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  { timestamps: true }
);

// ── Pre-save: Generate pharmacistId + Hash password ─────────────
pharmacistSchema.pre("save", async function () {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      "pharmacistId",
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true }
    );
    const padded = String(counter.seq).padStart(3, "0");
    this.pharmacistId = `PHM-${padded}`;
  }

  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// ── Instance Method: Compare password ──────────────────────────
pharmacistSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("Pharmacist", pharmacistSchema);