const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const {
  getOverview,
  listUsersByRole,
  updateUserStatus,
  listPendingDoctors,
  verifyDoctor,
  approvePharmacistByAdmin,
  getFinancialTransactions,
} = require("../controllers/adminController");

router.use(protectAdmin);

router.get("/overview", getOverview);
router.get("/users/:role", listUsersByRole);
router.patch("/users/:role/:id/status", updateUserStatus);
router.get("/doctors/pending", listPendingDoctors);
router.patch("/doctors/:id/verify", verifyDoctor);
router.patch("/pharmacists/:id/approve", approvePharmacistByAdmin);
router.get("/financial-transactions", getFinancialTransactions);

module.exports = router;
