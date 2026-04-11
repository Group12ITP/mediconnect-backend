const { body, query, param } = require("express-validator");

// ── Search by name ──────────────────────────────────────────────
const searchValidation = [
  query("q")
    .trim()
    .notEmpty().withMessage("Search query is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be 2–100 characters"),
];

// ── Get brands by RXCUI ─────────────────────────────────────────
const rxcuiParamValidation = [
  param("rxcui")
    .trim()
    .notEmpty().withMessage("RXCUI is required"),
];

// ── Suggest brands for prescription medicines ───────────────────
const prescriptionSuggestValidation = [
  body("prescriptionId")
    .trim()
    .notEmpty().withMessage("Prescription ID is required")
    .matches(/^RX-\d+$/).withMessage("Invalid prescription ID format"),
];

// ── Suggest brands by medicine name (direct) ───────────────────
const nameSuggestValidation = [
  body("medicineName")
    .trim()
    .notEmpty().withMessage("Medicine name is required")
    .isLength({ min: 2, max: 200 }).withMessage("Medicine name must be 2–200 characters"),
];

module.exports = {
  searchValidation,
  rxcuiParamValidation,
  prescriptionSuggestValidation,
  nameSuggestValidation,
};