const { body, param, query } = require("express-validator");

// ── Add / Update Inventory Item ────────────────────────────────
const inventoryItemValidation = [
  body("rxcui")
    .trim()
    .notEmpty().withMessage("RxNorm RXCUI is required"),

  body("genericName")
    .trim()
    .notEmpty().withMessage("Generic medicine name is required")
    .isLength({ max: 200 }).withMessage("Generic name too long"),

  body("brandName")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Brand name too long"),

  body("manufacturer")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Manufacturer name too long"),

  body("dosageForm")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Dosage form too long"),

  body("strength")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Strength too long"),

  body("quantityInStock")
    .notEmpty().withMessage("Quantity in stock is required")
    .isInt({ min: 0 }).withMessage("Quantity must be 0 or more"),

  body("pricePerUnit")
    .notEmpty().withMessage("Price per unit is required")
    .isFloat({ min: 0 }).withMessage("Price must be 0 or more"),

  body("unit")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Unit too long"),

  body("reorderLevel")
    .optional()
    .isInt({ min: 0 }).withMessage("Reorder level must be 0 or more"),

  body("currency")
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage("Currency must be 3 letters (e.g. LKR)"),

  body("requiresPrescription")
    .optional()
    .isBoolean().withMessage("requiresPrescription must be true or false"),

  body("expiryDate")
    .optional()
    .isISO8601().withMessage("Expiry date must be a valid date (ISO 8601)")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiry date must be in the future");
      }
      return true;
    }),
];

// ── Update Stock (quantity + price only) ───────────────────────
const stockUpdateValidation = [
  body("quantityInStock")
    .optional()
    .isInt({ min: 0 }).withMessage("Quantity must be 0 or more"),

  body("pricePerUnit")
    .optional()
    .isFloat({ min: 0 }).withMessage("Price must be 0 or more"),

  body("isAvailable")
    .optional()
    .isBoolean().withMessage("isAvailable must be true or false"),
];

// ── Adjust Stock (increment/decrement) ─────────────────────────
const stockAdjustValidation = [
  body("adjustment")
    .notEmpty().withMessage("Adjustment value is required")
    .isInt().withMessage("Adjustment must be an integer (positive to add, negative to remove)"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Reason cannot exceed 200 characters"),
];

// ── Inventory item ID param ─────────────────────────────────────
const itemIdParam = [
  param("itemId")
    .notEmpty().withMessage("Item ID is required")
    .isMongoId().withMessage("Invalid item ID"),
];

// ── Search query ────────────────────────────────────────────────
const searchQueryValidation = [
  query("q")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be 2–100 characters"),

  query("rxcui")
    .optional()
    .trim()
    .notEmpty().withMessage("RXCUI cannot be empty"),
];

module.exports = {
  inventoryItemValidation,
  stockUpdateValidation,
  stockAdjustValidation,
  itemIdParam,
  searchQueryValidation,
};