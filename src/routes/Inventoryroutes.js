const express = require("express");
const router = express.Router();

const {
  addInventoryItem,
  getMyInventory,
  getInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
  getLowStockAlerts,
  rxnormSearch,
  rxnormGetDetails,
} = require("../controllers/Inventorycontroller");

const {
  protect,
  restrictTo,
  requireApproved,
} = require("../middleware/pharmacistauthmiddleware");
const {
  inventoryItemValidation,
  stockUpdateValidation,
  stockAdjustValidation,
  itemIdParam,
  searchQueryValidation,
} = require("../middleware/Inventoryvalidators");

// ── All routes require authentication + approval ─────────────────
router.use(protect, requireApproved);

// ── RxNorm lookup routes (must be BEFORE /:itemId) ───────────────
router.get(
  "/rxnorm/search",
  restrictTo("pharmacist"),
  searchQueryValidation,
  rxnormSearch,
);
router.get("/rxnorm/:rxcui", restrictTo("pharmacist"), rxnormGetDetails);

// ── Low stock alerts ─────────────────────────────────────────────
router.get("/alerts/low-stock", restrictTo("pharmacist"), getLowStockAlerts);

// ── Inventory CRUD ───────────────────────────────────────────────
router.post(
  "/",
  restrictTo("pharmacist"),
  inventoryItemValidation,
  addInventoryItem,
);
router.get(
  "/",
  restrictTo("pharmacist"),
  searchQueryValidation,
  getMyInventory,
);
router.get("/:itemId", itemIdParam, getInventoryItem);
router.put(
  "/:itemId",
  restrictTo("pharmacist"),
  itemIdParam,
  stockUpdateValidation,
  updateInventoryItem,
);
router.patch(
  "/:itemId/adjust",
  restrictTo("pharmacist"),
  itemIdParam,
  stockAdjustValidation,
  adjustStock,
);
router.delete(
  "/:itemId",
  restrictTo("pharmacist"),
  itemIdParam,
  deleteInventoryItem,
);

module.exports = router;
