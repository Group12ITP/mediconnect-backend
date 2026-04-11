const { body, param } = require("express-validator");

// ── Create Prescription ─────────────────────────────────────────
const prescriptionValidation = [
  body("patientId")
    .trim()
    .notEmpty().withMessage("Patient ID is required")
    .matches(/^PAT-\d+$/).withMessage("Patient ID must be in PAT-001 format"),

  body("medicines")
    .isArray({ min: 1 }).withMessage("At least one medicine is required"),

  body("medicines.*.rxcui")
    .trim()
    .notEmpty().withMessage("RXCUI is required for each medicine"),

  body("medicines.*.genericName")
    .trim()
    .notEmpty().withMessage("Generic name is required for each medicine"),

  body("medicines.*.quantity")
    .optional()
    .isInt({ min: 1 }).withMessage("Quantity must be at least 1"),

  body("medicines.*.dosage")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Dosage too long"),

  body("medicines.*.duration")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Duration too long"),

  body("medicines.*.instructions")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Instructions too long"),

  body("diagnosis")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Diagnosis too long"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),

  body("validUntil")
    .optional()
    .isISO8601().withMessage("validUntil must be a valid date")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("validUntil must be a future date");
      }
      return true;
    }),
];

// ── Pharmacy Finder Request ─────────────────────────────────────
const finderValidation = [
  body("prescriptionId")
    .trim()
    .notEmpty().withMessage("Prescription ID is required")
    ,

  body("address")
    .notEmpty().withMessage("Your address is required to find nearby pharmacies"),

  body("priceWeight")
    .optional()
    .isFloat({ min: 0, max: 1 }).withMessage("priceWeight must be between 0 and 1"),

  body("distanceWeight")
    .optional()
    .isFloat({ min: 0, max: 1 }).withMessage("distanceWeight must be between 0 and 1"),
];

// ── Quick Finder ────────────────────────────────────────────────
const quickFinderValidation = [
  body("rxcui")
    .trim()
    .notEmpty().withMessage("RXCUI is required"),

  body("address")
    .notEmpty().withMessage("Your address is required"),
];

// ── Prescription ID param ───────────────────────────────────────
const prescriptionIdParam = [
  param("prescriptionId")
    .matches(/^RX-[\w-]+$/).withMessage("Invalid prescription ID format"),
];

module.exports = {
  prescriptionValidation,
  finderValidation,
  quickFinderValidation,
  prescriptionIdParam,
};