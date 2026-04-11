const express = require("express");
const router = express.Router();

const {
  createPharmacy,
  getMyPharmacy,
  getPharmacyById,
  getAllPharmacies,
  updatePharmacy,
  updateOperatingHours,
  verifyPharmacy,
  deletePharmacy,
} = require("../controllers/Pharmacycontroller");

const {
  protect,
  restrictTo,
  requireApproved,
} = require("../middleware/pharmacistauthmiddleware");
const {
  pharmacyValidation,
  operatingHoursValidation,
  pharmacyIdParam,
} = require("../middleware/Pharmacyvalidators");

// ── All routes require authentication ───────────────────────────
router.use(protect);

// ── Pharmacist routes ────────────────────────────────────────────
router.post(
  "/",
  requireApproved,
  restrictTo("pharmacist"),
  pharmacyValidation,
  createPharmacy,
);

router.get("/me", requireApproved, restrictTo("pharmacist"), getMyPharmacy);

router.put(
  "/me",
  requireApproved,
  restrictTo("pharmacist"),
  pharmacyValidation,
  updatePharmacy,
);

router.put(
  "/me/hours",
  requireApproved,
  restrictTo("pharmacist"),
  operatingHoursValidation,
  updateOperatingHours,
);

// ── Shared routes (all approved roles) ──────────────────────────
// Must be AFTER /me routes to avoid conflicts
router.get("/", requireApproved, getAllPharmacies);

router.get("/:pharmacyId", requireApproved, pharmacyIdParam, getPharmacyById);

// ── Admin only routes ────────────────────────────────────────────
router.patch(
  "/:pharmacyId/verify",
  restrictTo("admin"),
  pharmacyIdParam,
  verifyPharmacy,
);

router.delete(
  "/:pharmacyId",
  restrictTo("admin"),
  pharmacyIdParam,
  deletePharmacy,
);

module.exports = router;
