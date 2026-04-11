const { validationResult } = require("express-validator");
const Inventory = require("../models/Inventory");
const Pharmacy  = require("../models/Pharmacy");
const {
  searchMedicineByName,
  getMedicineByRxcui,
  resolveRxcui,
  validateRxcui,
  spellCheckMedicine,
} = require("../../utils/rxnorm");

// ── Helper: Validation errors ───────────────────────────────────
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return null;
};

// ── Helper: Get pharmacist's pharmacy or 404 ───────────────────
const getPharmacistPharmacy = async (userId) => {
  return Pharmacy.findOne({ pharmacist: userId });
};

// ═══════════════════════════════════════════════════════════════
//  INVENTORY CRUD
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────
// @desc    Add a medicine to own pharmacy inventory
// @route   POST /api/pharmacy/inventory
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const addInventoryItem = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: "No pharmacy profile found. Create your pharmacy profile first.",
      });
    }

    const {
      rxcui, genericName, brandName, manufacturer,
      dosageForm, strength, quantityInStock, unit,
      pricePerUnit, currency, reorderLevel,
      requiresPrescription, expiryDate,
    } = req.body;

    // Validate RXCUI with RxNorm API
    const validation = await validateRxcui(rxcui);
    
    console.log("Validation result:", validation); // For debugging
    
    // Check if valid - either isValid=true OR it's a pack
    if (!validation.isValid && validation.status !== "Pack") {
      // Try to suggest correct medicine
      const suggestions = await spellCheckMedicine(genericName).catch(() => []);
      return res.status(400).json({
        success: false,
        message: `Invalid RXCUI "${rxcui}". Status: ${validation.status}.`,
        suggestions: suggestions.slice(0, 5),
        hint: "Use GET /api/pharmacy/inventory/rxnorm/search?q=<name> to find the correct RXCUI.",
      });
    }

    // Check for duplicate (same medicine in same pharmacy)
    const existing = await Inventory.findOne({ pharmacy: pharmacy._id, rxcui });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `This medicine (RXCUI: ${rxcui}) is already in your inventory. Use the update endpoint.`,
        existingItemId: existing._id,
      });
    }

    // Create inventory item
    const item = await Inventory.create({
      pharmacy:             pharmacy._id,
      pharmacyId:           pharmacy.pharmacyId,
      rxcui,
      genericName,
      brandName:            brandName || "",
      manufacturer:         manufacturer || "",
      dosageForm:           dosageForm || (validation.isPack ? "Pack" : ""),
      strength:             strength || (validation.isPack ? "Combination Pack" : ""),
      quantityInStock,
      unit:                 unit || (validation.isPack ? "packs" : "units"),
      pricePerUnit,
      currency:             currency || "LKR",
      reorderLevel:         reorderLevel ?? 10,
      requiresPrescription: requiresPrescription ?? true,
      expiryDate:           expiryDate || null,
      isAvailable:          quantityInStock > 0,
    });

    return res.status(201).json({
      success: true,
      message: "Medicine added to inventory.",
      data: item,
    });
  } catch (error) {
    console.error("addInventoryItem error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get own pharmacy's full inventory
// @route   GET /api/pharmacy/inventory
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const getMyInventory = async (req, res) => {
  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found." });
    }

    const {
      page = 1, limit = 20,
      isAvailable, lowStock,
      q, // text search
    } = req.query;

    const filter = { pharmacy: pharmacy._id };

    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

    if (q) {
      filter.$or = [
        { genericName: { $regex: q, $options: "i" } },
        { brandName:   { $regex: q, $options: "i" } },
        { rxcui:       q },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Inventory.countDocuments(filter);
    let items   = await Inventory.find(filter)
      .sort({ genericName: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true });

    // Filter low stock in memory (virtual field)
    if (lowStock === "true") {
      items = items.filter((i) => i.quantityInStock <= i.reorderLevel);
    }

    return res.status(200).json({
      success: true,
      pharmacyId: pharmacy.pharmacyId,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: items,
    });
  } catch (error) {
    console.error("getMyInventory error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get single inventory item by ID
// @route   GET /api/pharmacy/inventory/:itemId
// @access  Private (pharmacist, admin)
// ───────────────────────────────────────────────────────────────
const getInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.itemId)
      .populate("pharmacy", "name address pharmacyId");

    if (!item) {
      return res.status(404).json({ success: false, message: "Inventory item not found." });
    }

    // Pharmacist can only view own pharmacy items
    if (req.user.role === "pharmacist") {
      const pharmacy = await getPharmacistPharmacy(req.user._id);
      if (!pharmacy || !item.pharmacy._id.equals(pharmacy._id)) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("getInventoryItem error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Update inventory item details
// @route   PUT /api/pharmacy/inventory/:itemId
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const updateInventoryItem = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found." });
    }

    const allowedFields = [
      "brandName", "manufacturer", "dosageForm", "strength",
      "quantityInStock", "unit", "pricePerUnit", "currency",
      "reorderLevel", "requiresPrescription", "expiryDate", "isAvailable",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Auto-set availability based on stock
    if (updates.quantityInStock !== undefined) {
      updates.isAvailable = updates.quantityInStock > 0;
    }

    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.itemId, pharmacy: pharmacy._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or does not belong to your pharmacy.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory item updated.",
      data: item,
    });
  } catch (error) {
    console.error("updateInventoryItem error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Adjust stock quantity (increment or decrement)
// @route   PATCH /api/pharmacy/inventory/:itemId/adjust
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const adjustStock = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found." });
    }

    const { adjustment, reason } = req.body;

    const item = await Inventory.findOne({
      _id: req.params.itemId,
      pharmacy: pharmacy._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found." });
    }

    const newQuantity = item.quantityInStock + Number(adjustment);

    if (newQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce stock below 0. Current stock: ${item.quantityInStock}, adjustment: ${adjustment}.`,
      });
    }

    item.quantityInStock = newQuantity;
    item.isAvailable     = newQuantity > 0;
    await item.save();

    return res.status(200).json({
      success: true,
      message: `Stock ${adjustment > 0 ? "increased" : "decreased"} by ${Math.abs(adjustment)}.${reason ? ` Reason: ${reason}` : ""}`,
      data: {
        rxcui:            item.rxcui,
        genericName:      item.genericName,
        previousQuantity: item.quantityInStock - Number(adjustment),
        adjustment:       Number(adjustment),
        newQuantity:      item.quantityInStock,
        isAvailable:      item.isAvailable,
      },
    });
  } catch (error) {
    console.error("adjustStock error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Remove a medicine from inventory
// @route   DELETE /api/pharmacy/inventory/:itemId
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const deleteInventoryItem = async (req, res) => {
  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found." });
    }

    const item = await Inventory.findOneAndDelete({
      _id: req.params.itemId,
      pharmacy: pharmacy._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found." });
    }

    return res.status(200).json({
      success: true,
      message: `${item.genericName} removed from inventory.`,
    });
  } catch (error) {
    console.error("deleteInventoryItem error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get low stock alerts for own pharmacy
// @route   GET /api/pharmacy/inventory/alerts/low-stock
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const getLowStockAlerts = async (req, res) => {
  try {
    const pharmacy = await getPharmacistPharmacy(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found." });
    }

    // Items where quantity <= reorderLevel using aggregation
    const lowStockItems = await Inventory.aggregate([
      { $match: { pharmacy: pharmacy._id } },
      {
        $addFields: {
          isLowStock: { $lte: ["$quantityInStock", "$reorderLevel"] },
        },
      },
      { $match: { isLowStock: true } },
      { $sort:  { quantityInStock: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      total:   lowStockItems.length,
      message: lowStockItems.length > 0
        ? `${lowStockItems.length} item(s) are running low.`
        : "All stock levels are healthy.",
      data: lowStockItems,
    });
  } catch (error) {
    console.error("getLowStockAlerts error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ═══════════════════════════════════════════════════════════════
//  RXNORM INTEGRATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// @desc    Search RxNorm for medicine by name
// @route   GET /api/pharmacy/inventory/rxnorm/search?q=paracetamol
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const rxnormSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters.",
      });
    }

    const results = await searchMedicineByName(q.trim());

    if (results.length === 0) {
      // Try spelling suggestions
      const suggestions = await spellCheckMedicine(q.trim()).catch(() => []);
      return res.status(200).json({
        success: true,
        total:       0,
        data:        [],
        suggestions: suggestions.slice(0, 5),
        message:     suggestions.length > 0
          ? `No results found. Did you mean: ${suggestions.slice(0, 3).join(", ")}?`
          : "No results found for this medicine name.",
      });
    }

    return res.status(200).json({
      success: true,
      total:   results.length,
      data:    results,
    });
  } catch (error) {
    console.error("rxnormSearch error:", error);
    return res.status(500).json({ success: false, message: "RxNorm API error. Try again." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get full medicine details from RxNorm by RXCUI
// @route   GET /api/pharmacy/inventory/rxnorm/:rxcui
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const rxnormGetDetails = async (req, res) => {
  try {
    const { rxcui } = req.params;

    const [details, validation] = await Promise.all([
      getMedicineByRxcui(rxcui),
      validateRxcui(rxcui),
    ]);

    return res.status(200).json({
      success:    true,
      isValid:    validation.isValid,
      rxcuiStatus: validation.status,
      data:       details,
    });
  } catch (error) {
    console.error("rxnormGetDetails error:", error);
    return res.status(500).json({ success: false, message: "RxNorm API error." });
  }
};

module.exports = {
  addInventoryItem,
  getMyInventory,
  getInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
  getLowStockAlerts,
  rxnormSearch,
  rxnormGetDetails,
};