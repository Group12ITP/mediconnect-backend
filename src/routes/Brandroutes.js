const express = require("express");
const router = express.Router();

const {
  searchMedicine,
  getBrandsByRxcui,
  suggestBrandsForPrescription,
  suggestBrandsByName,
  getDrugLabel,
} = require("../controllers/BrandController");

const {
  protect,
  requireApproved,
} = require("../middleware/pharmacistauthmiddleware");
const {
  searchValidation,
  rxcuiParamValidation,
  prescriptionSuggestValidation,
  nameSuggestValidation,
} = require("../middleware/brandValidators");

// ── All routes require authentication ───────────────────────────
router.use(protect, requireApproved);

// ── Search medicine by name ──────────────────────────────────────
// GET /api/medicines/search?q=paracetamol
router.get("/search", searchValidation, searchMedicine);

// ── Suggest brands for a full prescription (auto-fetch) ──────────
// Most important endpoint — patient/doctor calls this after prescription is issued
router.post(
  "/suggest/prescription",
  prescriptionSuggestValidation,
  suggestBrandsForPrescription,
);

// ── Suggest brands by typing a medicine name ─────────────────────
router.post("/suggest", nameSuggestValidation, suggestBrandsByName);

// ── Get all brands + quality scores for a specific RXCUI ─────────
router.get("/brands/:rxcui", rxcuiParamValidation, getBrandsByRxcui);

// ── Get full FDA label + recall info for a brand name ────────────
// Must be AFTER /brands/:rxcui and /suggest to avoid route conflicts
router.get("/label/:brandName", getDrugLabel);

module.exports = router;
