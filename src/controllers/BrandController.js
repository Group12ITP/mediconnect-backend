const { validationResult } = require("express-validator");
const Prescription = require("../models/Prescription");
const {
  resolveRxcui,
  searchMedicineByName,
  getBrandsForRxcui,
  getIngredientInfo,
  spellCheckMedicine,
  getBrandDetails,
} = require("../../utils/rxnorm");
const {
  checkRecalls,
  getAdverseEventCount,
  getDrugLabelInfo,
  getNdcInfo,
} = require("../../utils/Openfda");
const { scoreBrand, rankBrands } = require("../../utils/brandScoring");

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

// ── Core helper: Fetch + score all brands for one RXCUI ─────────
const fetchAndScoreBrands = async (rxcui, genericName) => {
  // 1. Get all brand names from RxNorm
  const brands = await getBrandsForRxcui(rxcui);

  if (brands.length === 0) {
    return { brands: [], message: "No brand alternatives found for this medicine." };
  }

  // 2. For each brand, gather quality signals in parallel
  // Limit to first 8 brands to stay within API rate limits
  const brandsToScore = brands.slice(0, 8);

  const scoredBrands = await Promise.all(
    brandsToScore.map(async (brand) => {
      const brandName = brand.name.split(" ")[0]; // Extract base brand name

      // Fire all quality checks in parallel for this brand
      const [recallInfo, labelInfo, adverseInfo, brandDetails] = await Promise.all([
        checkRecalls(brandName),
        getDrugLabelInfo(brandName),
        getAdverseEventCount(genericName),
        getBrandDetails(brand.rxcui).catch(() => ({})),
      ]);

      const { score, signals } = scoreBrand(brand, recallInfo, labelInfo, adverseInfo);

      return {
        rxcui:        brand.rxcui,
        brandName:    brand.name,
        genericName,
        tty:          brand.tty,
        dosageForm:   brandDetails.dosageForm  || labelInfo?.dosageFormName || "",
        strength:     brandDetails.strength    || "",
        manufacturer: brandDetails.labeler     || labelInfo?.manufacturer   || "",
        qualityScore: score,
        qualitySignals: signals,
        recallInfo: {
          hasRecall:    recallInfo.hasRecall,
          recallCount:  recallInfo.recallCount,
          recentRecalls: recallInfo.recentRecalls,
        },
        fdaRegistered: !!labelInfo,
        warnings:     labelInfo?.warnings
          ? labelInfo.warnings.substring(0, 300) + "..."
          : null,
      };
    })
  );

  const ranked = rankBrands(scoredBrands);
  return { brands: ranked };
};

// ═══════════════════════════════════════════════════════════════
//  CONTROLLERS
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// @desc    Search medicine by name → get RXCUI + basic info
// @route   GET /api/medicines/search?q=paracetamol
// @access  Private (all roles)
// ───────────────────────────────────────────────────────────────
const searchMedicine = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { q } = req.query;

    const results = await searchMedicineByName(q);

    if (results.length === 0) {
      const suggestions = await spellCheckMedicine(q).catch(() => []);
      return res.status(200).json({
        success:     true,
        total:       0,
        data:        [],
        suggestions: suggestions.slice(0, 5),
        message: suggestions.length > 0
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
    console.error("searchMedicine error:", error);
    return res.status(500).json({ success: false, message: "RxNorm API unavailable. Try again." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get all brands + quality ranking for a medicine by RXCUI
// @route   GET /api/medicines/brands/:rxcui
// @access  Private (all roles)
// ───────────────────────────────────────────────────────────────
const getBrandsByRxcui = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { rxcui } = req.params;

    // Get generic name first
    const ingredientInfo = await getIngredientInfo(rxcui);
    const genericName    = ingredientInfo.name || rxcui;

    const { brands, message } = await fetchAndScoreBrands(rxcui, genericName);

    if (brands.length === 0) {
      return res.status(200).json({
        success: true,
        rxcui,
        genericName,
        total:   0,
        data:    [],
        message: message || "No brands found.",
      });
    }

    return res.status(200).json({
      success:     true,
      rxcui,
      genericName,
      total:       brands.length,
      topBrand:    brands[0], // The highest quality recommendation
      data:        brands,
      scoringInfo: {
        methodology: "Brands scored on: absence of FDA recalls (40pts), FDA label registration (20pts), adverse event volume (20pts), manufacturer info (10pts), brand detail completeness (10pts).",
        maxScore:    100,
        sources:     ["RxNorm (NLM)", "OpenFDA Drug Enforcement", "OpenFDA Drug Label"],
      },
    });
  } catch (error) {
    console.error("getBrandsByRxcui error:", error);
    return res.status(500).json({ success: false, message: "Error fetching brand data." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Suggest best brands for each medicine in a prescription
//          Auto-fetches prescription, returns ranked brands per medicine
// @route   POST /api/medicines/suggest/prescription
// @access  Private (patient, doctor)
// ───────────────────────────────────────────────────────────────
const suggestBrandsForPrescription = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { prescriptionId } = req.body;

    // ── Fetch prescription ────────────────────────────────────
    const prescFilter =
      req.user.role === "patient"
        ? { prescriptionId, patient: req.user._id }
        : { prescriptionId }; // Doctors can view any

    const prescription = await Prescription.findOne(prescFilter)
      .populate("doctor", "name specialization")
      .populate("patient", "name");

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: `Prescription ${prescriptionId} not found.`,
      });
    }

    // ── For each medicine, fetch and score brands ─────────────
    // Process sequentially to respect API rate limits
    const medicineResults = [];

    for (const med of prescription.medicines) {
      try {
        const resolvedRxcui = med.rxcui || (med.name ? await resolveRxcui(med.name) : null);
        if (!resolvedRxcui) {
          throw new Error("RXCUI not available for medicine");
        }
        const { brands, message } = await fetchAndScoreBrands(
          resolvedRxcui,
          med.genericName || med.name
        );

        medicineResults.push({
          rxcui:       resolvedRxcui,
          genericName: med.genericName || med.name,
          prescribedBrandName: med.brandName || null,
          dosage:      med.dosage,
          duration:    med.duration,
          quantity:    med.quantity,
          instructions: med.instructions,

          brandSuggestions: {
            total:    brands.length,
            topBrand: brands[0] || null,
            allBrands: brands,
            message:  message || null,
          },
        });

        // Small delay between medicines to respect API rate limits
        await new Promise((r) => setTimeout(r, 300));
      } catch (medErr) {
        // Don't let one medicine failure break the whole response
        console.error(`Brand fetch failed for ${med.genericName}:`, medErr.message);
        medicineResults.push({
          rxcui:       med.rxcui,
          genericName: med.genericName,
          dosage:      med.dosage,
          duration:    med.duration,
          quantity:    med.quantity,
          brandSuggestions: {
            total:    0,
            topBrand: null,
            allBrands: [],
            message:  "Brand data temporarily unavailable for this medicine.",
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      prescription: {
        prescriptionId:  prescription.prescriptionId,
        status:          prescription.status,
        validUntil:      prescription.validUntil,
        diagnosis:       prescription.diagnosis,
        issuedBy: {
          doctorId:       prescription.doctor?._id,
          name:           prescription.doctor
            ? `Dr. ${prescription.doctor.name}`
            : null,
          specialization: prescription.doctor?.specialization,
        },
        patient: {
          patientId: prescription.patient?._id,
          name: prescription.patient?.name || null,
        },
      },
      medicinesCount:   medicineResults.length,
      medicines:        medicineResults,
      disclaimer: "Brand quality scores are based on FDA recall history, drug label registration, and adverse event reports. Always follow your doctor's advice before switching brands.",
    });
  } catch (error) {
    console.error("suggestBrandsForPrescription error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Suggest best brands for a single medicine name (no prescription)
// @route   POST /api/medicines/suggest
// @access  Private (all roles)
// ───────────────────────────────────────────────────────────────
const suggestBrandsByName = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { medicineName } = req.body;

    // Step 1: Resolve name → RXCUI
    const rxcui = await resolveRxcui(medicineName);

    if (!rxcui) {
      const suggestions = await spellCheckMedicine(medicineName).catch(() => []);
      return res.status(404).json({
        success:     false,
        message:     `Could not find "${medicineName}" in RxNorm database.`,
        suggestions: suggestions.slice(0, 5),
        hint:        suggestions.length > 0
          ? `Did you mean: ${suggestions.slice(0, 3).join(", ")}?`
          : "Try searching with the generic/scientific name.",
      });
    }

    // Step 2: Get ingredient info
    const ingredientInfo = await getIngredientInfo(rxcui);

    // Step 3: Fetch and score brands
    const { brands, message } = await fetchAndScoreBrands(
      rxcui,
      ingredientInfo.name || medicineName
    );

    return res.status(200).json({
      success:     true,
      searchedName: medicineName,
      resolvedTo:  {
        rxcui,
        genericName: ingredientInfo.name || medicineName,
        dosageForm:  ingredientInfo.dosageForm,
        strength:    ingredientInfo.strength,
      },
      brandSuggestions: {
        total:    brands.length,
        topBrand: brands[0] || null,
        allBrands: brands,
        message:  message || null,
      },
      disclaimer: "Brand recommendations are based on FDA data. Consult your doctor or pharmacist before switching brands.",
    });
  } catch (error) {
    console.error("suggestBrandsByName error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get full FDA drug label info for a brand
// @route   GET /api/medicines/label/:brandName
// @access  Private (all roles)
// ───────────────────────────────────────────────────────────────
const getDrugLabel = async (req, res) => {
  try {
    const { brandName } = req.params;

    const [labelInfo, recallInfo, ndcInfo] = await Promise.all([
      getDrugLabelInfo(brandName),
      checkRecalls(brandName),
      getNdcInfo(brandName),
    ]);

    if (!labelInfo && ndcInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No FDA data found for brand "${brandName}".`,
      });
    }

    return res.status(200).json({
      success: true,
      brandName,
      label:   labelInfo,
      recalls: recallInfo,
      ndcProducts: ndcInfo,
    });
  } catch (error) {
    console.error("getDrugLabel error:", error);
    return res.status(500).json({ success: false, message: "FDA API error." });
  }
};

module.exports = {
  searchMedicine,
  getBrandsByRxcui,
  suggestBrandsForPrescription,
  suggestBrandsByName,
  getDrugLabel,
};