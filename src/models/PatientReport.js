// models/PatientReport.js
const mongoose = require("mongoose");

const patientReportSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",   // or "PatientAppointment" if that's what you use
    },
    type: {
      type: String,
      enum: ["SUGAR", "CHOLESTEROL", "BLOOD_PRESSURE"],
      required: true,
    },
    value: {
      sugar: Number,
      cholesterol: Number,
      bp: {
        systolic: Number,
        diastolic: Number,
      },
    },
    unit: {
      type: String,
      required: true,
    },
    measuredAt: {
      type: Date,
      default: Date.now,
    },
    analysis: {
      type: Object,
      required: false,
    },
    classification: {
      type: String,
      enum: [
        "CRITICAL_LOW",
        "LOW",
        "LOW_WARNING",
        "NORMAL",
        "HIGH_WARNING",
        "HIGH",
        "CRITICAL_HIGH",
      ],
      required: true,
    },
    thresholdVersion: String,
  },
  {
    timestamps: true,
  }
);

// ====================== SAFE MODEL REGISTRATION ======================
const PatientReport = mongoose.models.PatientReport || 
                      mongoose.model("PatientReport", patientReportSchema);

module.exports = PatientReport;