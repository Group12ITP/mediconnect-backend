const express = require("express");
const router = express.Router();

const {
  createPrescription,
  getMyIssuedPrescriptions,
  getMyPrescriptions,
  getPrescriptionById,
  markDispensed,
  findPharmaciesForPrescription,
  quickFindByMedicine,
} = require("../controllers/FinderController");

const {
  protect,
  restrictTo,
  requireApproved,
} = require("../middleware/pharmacistauthmiddleware");
const {
  prescriptionValidation,
  finderValidation,
  quickFinderValidation,
  prescriptionIdParam,
} = require("../middleware/findervalidators");

// ── All routes require authentication ───────────────────────────
router.use(protect, requireApproved);

// ── Prescription: Doctor routes ──────────────────────────────────
router.post(
  "/",
  restrictTo("doctor"),
  prescriptionValidation,
  createPrescription,
);

router.get("/my-issued", restrictTo("doctor"), getMyIssuedPrescriptions);

// ── Prescription: Patient routes ─────────────────────────────────
// Auto-fetched when patient opens pharmacy finder
router.get("/my", restrictTo("patient"), getMyPrescriptions);

// ── Finder: Core feature ─────────────────────────────────────────
// Patient submits prescriptionId + address → gets top 3 pharmacies
router.post(
  "/finder",
  restrictTo("patient"),
  finderValidation,
  findPharmaciesForPrescription,
);

// Quick finder: search by single RXCUI without a prescription
router.post(
  "/finder/quick",
  restrictTo("patient", "doctor"),
  quickFinderValidation,
  quickFindByMedicine,
);

// ── Prescription: Shared routes ──────────────────────────────────
// Must be AFTER /my and /finder to avoid route conflicts
router.get("/:prescriptionId", prescriptionIdParam, getPrescriptionById);

// Pharmacist marks as dispensed after handing over medicines
router.patch(
  "/:prescriptionId/dispense",
  restrictTo("pharmacist"),
  prescriptionIdParam,
  markDispensed,
);

module.exports = router;
