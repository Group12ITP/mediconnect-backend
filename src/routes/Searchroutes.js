const express = require("express");
const router = express.Router();

const {
  searchDoctors,
  autocomplete,
  getSpecializations,
  getCities,
  getDoctorDetails,
} = require("../Controllers/Searchcontroller");

const { protect, requireApproved } = require("../Middleware/Authmiddleware");
const { searchValidation } = require("../Middleware/validation/Searchvalidators");

// ── All routes require authentication ───────────────────────────
router.use(protect, requireApproved);

// ── Dropdown Data (call these to populate filter UI) ────────────
// Must be defined BEFORE /:doctorId to avoid route conflicts
router.get("/specializations", getSpecializations);
router.get("/cities", getCities);

// ── Autocomplete (for live search input) ────────────────────────
router.get("/autocomplete", autocomplete);

// ── Main Search ──────────────────────────────────────────────────
router.get("/", searchValidation, searchDoctors);

// ── Single Doctor Detail View ────────────────────────────────────
router.get("/:doctorId", getDoctorDetails);

module.exports = router;
