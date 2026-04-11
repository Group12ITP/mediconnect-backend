const { validationResult } = require("express-validator");
const Pharmacy   = require("../models/Pharmacy");
const Pharmacist = require("../models/Pharmacist");
const {
  geocodeAddress,
  buildAddressString,
  buildDirectionsUrl,
  buildLeafletMarker,
} = require("../../utils/geocoding");

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

const enrichWithMapData = (pharmacy) => {
  const obj = pharmacy.toObject ? pharmacy.toObject() : { ...pharmacy };
  if (obj.latitude && obj.longitude) {
    const fullAddress = [obj.address?.street, obj.address?.city, obj.address?.country]
      .filter(Boolean).join(", ");
    obj.directionsUrl = buildDirectionsUrl(obj.latitude, obj.longitude, obj.name);
    obj.leafletMarker = buildLeafletMarker(obj.latitude, obj.longitude, obj.name, fullAddress);
  }
  return obj;
};

// @desc Create pharmacy | @route POST /api/pharmacy/profile | @access Pharmacist
const createPharmacy = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;
  try {
    const existing = await Pharmacy.findOne({ pharmacist: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: "You already have a pharmacy profile. Use the update endpoint." });
    }
    const dupReg = await Pharmacy.findOne({ registrationNumber: req.body.registrationNumber });
    if (dupReg) {
      return res.status(409).json({ success: false, message: "A pharmacy with this registration number already exists." });
    }
    const { name, registrationNumber, email, phone, alternatePhone, address, description, is24Hours, operatingHours } = req.body;
    let lat = 0, lng = 0, geocodedDisplay = "";
    try {
      const geo = await geocodeAddress(buildAddressString(address));
      lat = geo.lat; lng = geo.lng; geocodedDisplay = geo.displayName;
    } catch (geoErr) {
      console.warn("Geocoding failed, storing 0,0 —", geoErr.message);
    }
    const pharmacy = await Pharmacy.create({
      pharmacist: req.user._id, pharmacistId: req.user.pharmacistId,
      name, registrationNumber, email: email || "", phone,
      alternatePhone: alternatePhone || "", address,
      description: description || "", is24Hours: is24Hours || false,
      operatingHours: operatingHours || [], latitude: lat, longitude: lng,
      location: { type: "Point", coordinates: [lng, lat] },
    });
    await Pharmacist.findByIdAndUpdate(req.user._id, { pharmacy: pharmacy._id });
    return res.status(201).json({
      success: true, message: "Pharmacy profile created successfully.",
      data: enrichWithMapData(pharmacy), geocodedAddress: geocodedDisplay || null,
    });
  } catch (error) {
    console.error("createPharmacy error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Get own pharmacy | @route GET /api/pharmacy/profile/me | @access Pharmacist
const getMyPharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ pharmacist: req.user._id })
      .populate("pharmacist", "firstName lastName email pharmacistId licenseNumber");
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "No pharmacy profile found. Please create one first." });
    }
    return res.status(200).json({ success: true, data: enrichWithMapData(pharmacy) });
  } catch (error) {
    console.error("getMyPharmacy error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Get by ID | @route GET /api/pharmacy/profile/:pharmacyId | @access All roles
const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ pharmacyId: req.params.pharmacyId })
      .populate("pharmacist", "firstName lastName email pharmacistId");
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: `Pharmacy ${req.params.pharmacyId} not found.` });
    }
    return res.status(200).json({ success: true, data: enrichWithMapData(pharmacy) });
  } catch (error) {
    console.error("getPharmacyById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Get all | @route GET /api/pharmacy/profile | @access All roles
const getAllPharmacies = async (req, res) => {
  try {
    const { city, isVerified, isActive, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (city)                     filter["address.city"] = { $regex: city, $options: "i" };
    if (isVerified !== undefined) filter.isVerified = isVerified === "true";
    if (isActive   !== undefined) filter.isActive   = isActive   === "true";
    const total = await Pharmacy.countDocuments(filter);
    const pharmacies = await Pharmacy.find(filter)
      .populate("pharmacist", "firstName lastName email pharmacistId")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    return res.status(200).json({
      success: true, total, page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: pharmacies.map(enrichWithMapData),
    });
  } catch (error) {
    console.error("getAllPharmacies error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Update | @route PUT /api/pharmacy/profile/me | @access Pharmacist
const updatePharmacy = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;
  try {
    const allowedFields = ["name", "email", "phone", "alternatePhone", "address", "description", "is24Hours"];
    const updates = {};
    allowedFields.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    if (updates.address) {
      try {
        const geo = await geocodeAddress(buildAddressString(updates.address));
        updates.latitude  = geo.lat;
        updates.longitude = geo.lng;
        updates.location  = { type: "Point", coordinates: [geo.lng, geo.lat] };
      } catch (geoErr) { console.warn("Re-geocoding failed:", geoErr.message); }
    }
    const pharmacy = await Pharmacy.findOneAndUpdate(
      { pharmacist: req.user._id }, { $set: updates },
      { new: true, runValidators: true }
    ).populate("pharmacist", "firstName lastName email pharmacistId");
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy not found. Create one first." });
    }
    return res.status(200).json({ success: true, message: "Pharmacy updated successfully.", data: enrichWithMapData(pharmacy) });
  } catch (error) {
    console.error("updatePharmacy error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Update hours | @route PUT /api/pharmacy/profile/me/hours | @access Pharmacist
const updateOperatingHours = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;
  try {
    const { operatingHours, is24Hours } = req.body;
    const pharmacy = await Pharmacy.findOneAndUpdate(
      { pharmacist: req.user._id },
      { $set: { operatingHours, is24Hours: is24Hours || false } },
      { new: true, runValidators: true }
    );
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found." });
    return res.status(200).json({
      success: true, message: "Operating hours updated.",
      data: { operatingHours: pharmacy.operatingHours, is24Hours: pharmacy.is24Hours },
    });
  } catch (error) {
    console.error("updateOperatingHours error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Verify | @route PATCH /api/pharmacy/profile/:pharmacyId/verify | @access Admin
const verifyPharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ pharmacyId: req.params.pharmacyId });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found." });
    if (pharmacy.isVerified) return res.status(400).json({ success: false, message: "Already verified." });
    pharmacy.isVerified = true;
    await pharmacy.save();
    return res.status(200).json({ success: true, message: `${pharmacy.name} (${pharmacy.pharmacyId}) verified.`, data: enrichWithMapData(pharmacy) });
  } catch (error) {
    console.error("verifyPharmacy error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc Delete | @route DELETE /api/pharmacy/profile/:pharmacyId | @access Admin
const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ pharmacyId: req.params.pharmacyId });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found." });
    await Pharmacist.findByIdAndUpdate(pharmacy.pharmacist, { pharmacy: null });
    await pharmacy.deleteOne();
    return res.status(200).json({ success: true, message: `Pharmacy ${req.params.pharmacyId} deleted.` });
  } catch (error) {
    console.error("deletePharmacy error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createPharmacy, getMyPharmacy, getPharmacyById, getAllPharmacies,
  updatePharmacy, updateOperatingHours, verifyPharmacy, deletePharmacy,
};