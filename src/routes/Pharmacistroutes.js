const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  approvePharmacist,
  getAllPharmacists,
} = require("../controllers/Pharmacistauthcontroller");

const {
  protect,
  restrictTo,
  requireApproved,
} = require("../middleware/pharmacistauthmiddleware");
const {
  pharmacistRegisterValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
} = require("../middleware/pharmacistvalidators");

// ── Public ───────────────────────────────────────────────────────
router.post("/register", pharmacistRegisterValidation, register);
router.post("/login", loginValidation, login);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/reset-password", resetPasswordValidation, resetPassword);

// ── Private (pharmacist) ─────────────────────────────────────────
router.get("/me", protect, requireApproved, getMe);
router.post("/logout-all", protect, logoutAll);
router.put(
  "/change-password",
  protect,
  requireApproved,
  changePasswordValidation,
  changePassword,
);

// ── Admin only ───────────────────────────────────────────────────
router.get("/all", protect, restrictTo("admin"), getAllPharmacists);
router.patch("/approve/:id", protect, restrictTo("admin"), approvePharmacist);

module.exports = router;
