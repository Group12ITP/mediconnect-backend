const express = require("express");
const router = express.Router();
const { registerAdmin, loginAdmin, getAdminMe } = require("../controllers/adminAuthController");
const { protectAdmin } = require("../middleware/adminAuthMiddleware");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/me", protectAdmin, getAdminMe);

module.exports = router;
