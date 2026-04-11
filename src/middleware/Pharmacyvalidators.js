const { body, param } = require("express-validator");

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ── Create / Update Pharmacy ────────────────────────────────────
const pharmacyValidation = [
  body("name")
    .trim()
    .notEmpty().withMessage("Pharmacy name is required")
    .isLength({ max: 200 }).withMessage("Name cannot exceed 200 characters"),

  body("registrationNumber")
    .trim()
    .notEmpty().withMessage("Registration number is required"),

  body("phone")
    .trim()
    .notEmpty().withMessage("Phone number is required")
    .matches(/^[+]?[\d\s\-().]{7,20}$/).withMessage("Invalid phone number"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),

  body("address.street")
    .trim()
    .notEmpty().withMessage("Street address is required"),

  body("address.city")
    .trim()
    .notEmpty().withMessage("City is required"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  body("is24Hours")
    .optional()
    .isBoolean().withMessage("is24Hours must be true or false"),
];

// ── Operating Hours Validation ──────────────────────────────────
const operatingHoursValidation = [
  body("operatingHours")
    .isArray({ min: 1, max: 7 })
    .withMessage("operatingHours must be an array of 1–7 day entries"),

  body("operatingHours.*.dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("dayOfWeek must be 0 (Sun) to 6 (Sat)"),

  body("operatingHours.*.isOpen")
    .optional()
    .isBoolean().withMessage("isOpen must be true or false"),

  body("operatingHours.*.openTime")
    .optional()
    .matches(TIME_REGEX).withMessage("openTime must be HH:MM (24hr)"),

  body("operatingHours.*.closeTime")
    .optional()
    .matches(TIME_REGEX).withMessage("closeTime must be HH:MM (24hr)")
    .custom((closeTime, { req }) => {
      // Can only validate per-item if we have access to sibling fields
      return true;
    }),
];

// ── Pharmacy ID param ───────────────────────────────────────────
const pharmacyIdParam = [
  param("pharmacyId")
    .notEmpty().withMessage("Pharmacy ID is required")
    .matches(/^PHARM-\d+$/).withMessage("Invalid pharmacy ID format (e.g. PHARM-001)"),
];

module.exports = {
  pharmacyValidation,
  operatingHoursValidation,
  pharmacyIdParam,
};