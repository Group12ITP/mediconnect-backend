const { validationResult } = require("express-validator");
const Prescription = require("../models/Prescription");
const Pharmacy = require("../models/Pharmacy");
const Inventory = require("../models/Inventory");
const Patient = require("../models/Patient");
const { geocodeAddress, buildAddressString, haversineDistance } = require("../../utils/geocoding");
const { rankPharmacies, formatPharmacyResult } = require("../../utils/finderAlgorithm");
const { resolveRxcui } = require("../../utils/rxnorm");

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

// ═══════════════════════════════════════════════════════════════
//  PRESCRIPTION MANAGEMENT (Doctor-facing)
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// @desc    Doctor creates a prescription for a patient
// @route   POST /api/prescriptions
// @access  Private (doctor)
// ───────────────────────────────────────────────────────────────
const createPrescription = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { patientId, medicines, diagnosis, notes, validUntil } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Patient ${patientId} not found.`,
      });
    }

    const prescription = await Prescription.create({
      doctor:    req.user._id,
      patientName: patient.name,
      patient:   patient._id,
      patientId: String(patient._id),
      medicines,
      diagnosis: diagnosis || "",
      notes:     notes     || "",
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Prescription ${prescription.prescriptionId} created for ${patient.name}.`,
      data: prescription,
    });
  } catch (error) {
    console.error("createPrescription error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get all prescriptions issued by the logged-in doctor
// @route   GET /api/prescriptions/my-issued
// @access  Private (doctor)
// ───────────────────────────────────────────────────────────────
const getMyIssuedPrescriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { doctor: req.user._id };
    if (status) filter.status = status;

    const total = await Prescription.countDocuments(filter);
    const prescriptions = await Prescription.find(filter)
      .populate("patient", "name email phoneNumber")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.status(200).json({
      success: true, total,
      page: Number(page), totalPages: Math.ceil(total / Number(limit)),
      data: prescriptions,
    });
  } catch (error) {
    console.error("getMyIssuedPrescriptions error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get all prescriptions for the logged-in patient
//          (auto-fetched when patient opens pharmacy finder)
// @route   GET /api/prescriptions/my
// @access  Private (patient)
// ───────────────────────────────────────────────────────────────
const getMyPrescriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Build a name-safe regex for matching prescriptions written by doctors
    // who only stored patientName (no patient ObjectId reference)
    const escapeRegex = (s) => (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = req.user.name
      ? new RegExp(`^${escapeRegex(req.user.name)}$`, "i")
      : null;

    const orClauses = [{ patient: req.user._id }];
    if (nameRegex) orClauses.push({ patientName: nameRegex, patient: null });
    if (nameRegex) orClauses.push({ patientName: nameRegex, patient: { $exists: false } });

    const baseFilter = { $or: orClauses };
    if (status) baseFilter.status = status;

    const total = await Prescription.countDocuments(baseFilter);
    const prescriptions = await Prescription.find(baseFilter)
      .populate("doctor", "name specialization")
      .populate("dispensedAt", "name address pharmacyId")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.status(200).json({
      success: true, total,
      page: Number(page), totalPages: Math.ceil(total / Number(limit)),
      data: prescriptions,
    });
  } catch (error) {
    console.error("getMyPrescriptions error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get single prescription by prescriptionId
// @route   GET /api/prescriptions/:prescriptionId
// @access  Private (doctor, patient, pharmacist, admin)
// ───────────────────────────────────────────────────────────────
const getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      prescriptionId: req.params.prescriptionId,
    })
      .populate("doctor",      "firstName lastName doctorId specialization phone")
      .populate("patient",     "firstName lastName patientId email phone")
      .populate("dispensedAt", "name address pharmacyId phone");

    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found." });
    }

    // Access control: patient can only view their own
    if (req.user.role === "patient" && String(prescription.patient) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    // Doctor can only view their own issued prescriptions
    if (req.user.role === "doctor" && String(prescription.doctor) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    return res.status(200).json({ success: true, data: prescription });
  } catch (error) {
    console.error("getPrescriptionById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Mark prescription as dispensed (pharmacist confirms)
// @route   PATCH /api/prescriptions/:prescriptionId/dispense
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const markDispensed = async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      prescriptionId: req.params.prescriptionId,
    });

    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found." });
    }
    if (prescription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: `Cannot dispense a prescription with status: ${prescription.status}.`,
      });
    }

    // Get pharmacist's pharmacy
    const pharmacy = await Pharmacy.findOne({ pharmacist: req.user._id });
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Your pharmacy profile not found." });
    }

    prescription.status      = "dispensed";
    prescription.dispensedAt = pharmacy._id;
    prescription.dispensedOn = new Date();
    await prescription.save();

    return res.status(200).json({
      success: true,
      message: `Prescription ${prescription.prescriptionId} marked as dispensed.`,
      data: prescription,
    });
  } catch (error) {
    console.error("markDispensed error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PHARMACY FINDER — THE CORE FEATURE
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// @desc    Find top 3 pharmacies for a prescription
//
//  Flow:
//  1. Patient provides prescriptionId + their current address
//  2. System auto-fetches the prescription (all medicine RXCUIs)
//  3. Geocodes patient address via Nominatim → lat/lng
//  4. Finds all pharmacies that stock ALL medicines in the Rx
//  5. Calculates distance from patient to each pharmacy (Haversine)
//  6. Calculates total price at each pharmacy
//  7. Ranks by combined price+distance score (60% price, 40% distance)
//  8. Returns top 3 with Leaflet map markers + OpenStreetMap directions
//
// @route   POST /api/prescriptions/finder
// @access  Private (patient)
// ───────────────────────────────────────────────────────────────
const findPharmaciesForPrescription = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { prescriptionId, address, priceWeight, distanceWeight } = req.body;

    // ── Step 1: Fetch & validate prescription ──────────────────
    // Doctor-created prescriptions may only store patientName (no patient ObjectId).
    // Use $or so both linked and name-only prescriptions are found.
    const escapeRegex = (s) => (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = req.user.name
      ? new RegExp(`^${escapeRegex(req.user.name)}$`, "i")
      : null;

    const orClauses = [{ patient: req.user._id }];
    if (nameRegex) {
      orClauses.push({ patientName: nameRegex, patient: null });
      orClauses.push({ patientName: nameRegex, patient: { $exists: false } });
    }

    const prescription = await Prescription.findOne({
      prescriptionId,
      $or: orClauses,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: `Prescription ${prescriptionId} not found or does not belong to you.`,
      });
    }

    if (prescription.status === "expired") {
      return res.status(400).json({
        success: false,
        message: `Prescription ${prescriptionId} has expired (valid until ${prescription.validUntil.toDateString()}).`,
      });
    }

    if (prescription.status === "dispensed") {
      return res.status(400).json({
        success: false,
        message: `Prescription ${prescriptionId} has already been dispensed at ${prescription.dispensedAt}.`,
      });
    }

    // ── Step 2: Resolve inventory for each medicine ────────────
    // 3-tier fallback per medicine:
    //   Tier 1 — stored rxcui on the prescription medicine
    //   Tier 2 — RxNorm API lookup by generic/brand name
    //   Tier 3 — case-insensitive name match in inventory
    // (Prescriptions created through the doctor portal often have no rxcui)
    const INV_FIELDS = "pharmacy pharmacyId rxcui genericName brandName pricePerUnit currency quantityInStock dosageForm strength";
    const escapeRx = (s) => (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const availabilityByMedicine = await Promise.all(
      prescription.medicines.map(async (m) => {
        const seedName = m.genericName || m.name;

        // Tier 1: stored rxcui
        if (m.rxcui) {
          const items = await Inventory.find({
            rxcui: m.rxcui,
            isAvailable: true,
            quantityInStock: { $gt: 0 },
          }).select(INV_FIELDS);
          if (items.length > 0) return { label: m.rxcui, items };
        }

        // Tier 2: resolve rxcui from name via RxNorm API
        if (seedName) {
          const resolvedRxcui = await resolveRxcui(seedName).catch(() => null);
          if (resolvedRxcui) {
            const items = await Inventory.find({
              rxcui: resolvedRxcui,
              isAvailable: true,
              quantityInStock: { $gt: 0 },
            }).select(INV_FIELDS);
            if (items.length > 0) return { label: resolvedRxcui, items };
          }
        }

        // Tier 3: name-based inventory search (genericName or brandName)
        if (seedName) {
          const nameRegex = new RegExp(escapeRx(seedName), "i");
          const items = await Inventory.find({
            $or: [{ genericName: nameRegex }, { brandName: nameRegex }],
            isAvailable: true,
            quantityInStock: { $gt: 0 },
          }).select(INV_FIELDS);
          return { label: seedName, items };
        }

        return { label: m.name || "unknown", items: [] };
      })
    );

    // Validate every medicine has at least one pharmacy stocking it
    const missingMedicines = availabilityByMedicine.filter((r) => r.items.length === 0);
    if (missingMedicines.length > 0) {
      return res.status(200).json({
        success: false,
        message: "No single pharmacy currently stocks all medicines in this prescription.",
        partialCoverage: availabilityByMedicine.map((r, i) => ({
          medicine: prescription.medicines[i].genericName || prescription.medicines[i].name,
          pharmaciesWithIt: r.items.length,
        })),
        suggestion: "Consider visiting multiple pharmacies or ask your doctor for alternatives.",
      });
    }

    // ── Step 3: Geocode patient's address ──────────────────────
    let patientLat, patientLng, geocodedAddress;
    try {
      const addressStr = typeof address === "string"
        ? address
        : buildAddressString(address);
      const geo        = await geocodeAddress(addressStr);
      patientLat       = geo.lat;
      patientLng       = geo.lng;
      geocodedAddress  = geo.displayName;
    } catch (geoErr) {
      return res.status(400).json({
        success: false,
        message: `Could not locate your address: "${geoErr.message}". Please try a more specific address.`,
      });
    }

    // ── Step 4: Find pharmacies stocking ALL medicines ─────────
    // Intersect pharmacy sets across all medicines
    const pharmacyIdSets = availabilityByMedicine.map(
      (r) => new Set(r.items.map((i) => i.pharmacyId))
    );
    const universalPharmacyIds = [...pharmacyIdSets[0]].filter((id) =>
      pharmacyIdSets.every((set) => set.has(id))
    );

    if (universalPharmacyIds.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No single pharmacy currently stocks all medicines in this prescription.",
        partialCoverage: availabilityByMedicine.map((r, i) => ({
          medicine: prescription.medicines[i].genericName || prescription.medicines[i].name,
          pharmaciesWithIt: r.items.length,
        })),
        suggestion: "Consider visiting multiple pharmacies or ask your doctor for alternatives.",
      });
    }

    // ── Step 5: Fetch full pharmacy details ────────────────────
    const pharmacies = await Pharmacy.find({
      pharmacyId: { $in: universalPharmacyIds },
      isActive: true,
    });

    if (pharmacies.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Matching pharmacies found but none are currently active.",
      });
    }

    // ── Step 6: Build candidates with distance + total price ───
    const candidates = pharmacies.map((pharmacy) => {
      // Get this pharmacy's inventory item per medicine slot
      const medicineItems = availabilityByMedicine.map((r) =>
        r.items.find((i) => i.pharmacyId === pharmacy.pharmacyId)
      ).filter(Boolean);

      // Total price = pricePerUnit × (prescMed.quantity || 1) for each medicine
      const totalPrice = prescription.medicines.reduce((sum, prescMed, idx) => {
        const invItem = availabilityByMedicine[idx]?.items.find(
          (i) => i.pharmacyId === pharmacy.pharmacyId
        );
        const qty = prescMed.quantity || 1;
        return sum + (invItem ? invItem.pricePerUnit * qty : 0);
      }, 0);

      // Distance from patient to this pharmacy
      const distanceKm = (pharmacy.latitude && pharmacy.longitude)
        ? haversineDistance(patientLat, patientLng, pharmacy.latitude, pharmacy.longitude)
        : 9999; // Unknown distance pushed to end

      return { pharmacy, medicines: medicineItems, totalPrice, distanceKm };
    });

    // ── Step 6: Rank by combined score ─────────────────────────
    const pw = priceWeight    ? parseFloat(priceWeight)    : 0.6;
    const dw = distanceWeight ? parseFloat(distanceWeight) : 0.4;

    const top3 = rankPharmacies(candidates, pw, dw);

    // ── Step 7: Format response ────────────────────────────────
    const results = top3.map(formatPharmacyResult);

    return res.status(200).json({
      success: true,
      prescription: {
        prescriptionId:  prescription.prescriptionId,
        status:          prescription.status,
        validUntil:      prescription.validUntil,
        medicinesCount:  prescription.medicines.length,
        medicines:       prescription.medicines.map((m) => ({
          rxcui: m.rxcui || null,
          genericName: m.genericName || m.name,
          quantity:    m.quantity,
          dosage:      m.dosage,
        })),
        issuedBy: {
          doctorId: prescription.doctor ? String(prescription.doctor) : null,
        },
      },
      patientLocation: {
        geocodedAddress,
        latitude:  patientLat,
        longitude: patientLng,
      },
      pharmaciesFound:  universalPharmacyIds.length,
      rankingCriteria: {
        priceWeight:    pw,
        distanceWeight: dw,
        note: "Score = (priceWeight × normalisedPrice) + (distanceWeight × normalisedDistance). Lower score = better.",
      },
      topPharmacies: results,

      // All 3 Leaflet markers in one array — ready for frontend map
      leafletMarkers: results.map((r) => r.pharmacy.leafletMarker).filter(Boolean),
    });
  } catch (error) {
    console.error("findPharmaciesForPrescription error:", error);
    return res.status(500).json({ success: false, message: "Server error during pharmacy search." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Quick finder — search by medicine name without a prescription
//          Returns top 3 pharmacies stocking a single medicine
// @route   POST /api/prescriptions/finder/quick
// @access  Private (patient, doctor)
// ───────────────────────────────────────────────────────────────
const quickFindByMedicine = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { rxcui, address } = req.body;

    // Geocode patient address
    let patientLat, patientLng, geocodedAddress;
    try {
      const addressStr = typeof address === "string"
        ? address
        : buildAddressString(address);
      const geo        = await geocodeAddress(addressStr);
      patientLat       = geo.lat;
      patientLng       = geo.lng;
      geocodedAddress  = geo.displayName;
    } catch (geoErr) {
      return res.status(400).json({
        success: false,
        message: `Could not locate your address: "${geoErr.message}".`,
      });
    }

    // Find all pharmacies stocking this medicine
    const inventoryItems = await Inventory.find({
      rxcui,
      isAvailable:     true,
      quantityInStock: { $gt: 0 },
    }).select("pharmacy pharmacyId rxcui genericName brandName pricePerUnit currency quantityInStock");

    if (inventoryItems.length === 0) {
      return res.status(200).json({
        success: false,
        message:  `No pharmacies currently stock this medicine (RXCUI: ${rxcui}).`,
        topPharmacies: [],
      });
    }

    const pharmacyIds = [...new Set(inventoryItems.map((i) => i.pharmacyId))];
    const pharmacies  = await Pharmacy.find({
      pharmacyId: { $in: pharmacyIds },
      isActive:   true,
    });

    const candidates = pharmacies.map((pharmacy) => {
      const item = inventoryItems.find((i) => i.pharmacyId === pharmacy.pharmacyId);
      const distanceKm = (pharmacy.latitude && pharmacy.longitude)
        ? haversineDistance(patientLat, patientLng, pharmacy.latitude, pharmacy.longitude)
        : 9999;
      return {
        pharmacy,
        medicines:  [item],
        totalPrice: item.pricePerUnit,
        distanceKm,
      };
    });

    const top3   = rankPharmacies(candidates);
    const results = top3.map(formatPharmacyResult);

    return res.status(200).json({
      success: true,
      rxcui,
      geocodedAddress,
      topPharmacies:  results,
      leafletMarkers: results.map((r) => r.pharmacy.leafletMarker).filter(Boolean),
    });
  } catch (error) {
    console.error("quickFindByMedicine error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  // Prescriptions
  createPrescription,
  getMyIssuedPrescriptions,
  getMyPrescriptions,
  getPrescriptionById,
  markDispensed,
  // Finder
  findPharmaciesForPrescription,
  quickFindByMedicine,
};