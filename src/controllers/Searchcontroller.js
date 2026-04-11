const { validationResult } = require("express-validator");
const Doctor = require("../Models/Doctor");
const DoctorProfile = require("../Models/Doctorprofile");
const DateSlot = require("../Models/DateSlot");

// ── Helper: Format validation errors ───────────────────────────
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

// ── Helper: Build sort object from sortBy query param ──────────
const buildSortObject = (sortBy) => {
  const sortMap = {
    fee_asc:           { "consultationFee.amount": 1 },
    fee_desc:          { "consultationFee.amount": -1 },
    experience_asc:    { yearsOfExperience: 1 },
    experience_desc:   { yearsOfExperience: -1 },
    name_asc:          { _sortName: 1 },
    name_desc:         { _sortName: -1 },
  };
  return sortMap[sortBy] || { createdAt: -1 }; // default: newest first
};

// ───────────────────────────────────────────────────────────────
// @desc    Search doctors with filters, sorting & pagination
// @route   GET /api/doctors/search
// @access  Private (doctor, admin)
//
// Query params:
//   name          - partial name search (firstName or lastName)
//   specialization - exact or partial match
//   city          - partial match on affiliation.city
//   minFee        - minimum consultation fee
//   maxFee        - maximum consultation fee
//   minExperience - minimum years of experience
//   availableOn   - ISO date (e.g. 2026-03-15)
//   sortBy        - fee_asc | fee_desc | experience_asc | experience_desc | name_asc | name_desc
//   page          - page number (default: 1)
//   limit         - results per page (default: 10, max: 50)
// ───────────────────────────────────────────────────────────────
const searchDoctors = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const {
      name,
      specialization,
      city,
      minFee,
      maxFee,
      minExperience,
      availableOn,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    // ── Step 1: Build Doctor-level filter (auth collection) ─────
    const doctorFilter = {
      isApproved: true,
      isActive: true,
      role: "doctor",
    };

    if (specialization) {
      doctorFilter.specialization = { $regex: specialization, $options: "i" };
    }

    if (name) {
      // Search across both firstName and lastName
      doctorFilter.$or = [
        { firstName: { $regex: name, $options: "i" } },
        { lastName:  { $regex: name, $options: "i" } },
      ];
    }

    // Get matching doctor IDs from the Doctor collection
    const matchingDoctors = await Doctor.find(doctorFilter).select("_id doctorId");
    const matchingDoctorIds = matchingDoctors.map((d) => d._id);

    if (matchingDoctorIds.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page: Number(page),
        totalPages: 0,
        data: [],
      });
    }

    // ── Step 2: Build Profile-level filter ──────────────────────
    const profileFilter = {
      doctor: { $in: matchingDoctorIds },
    };

    if (city) {
      profileFilter["affiliation.city"] = { $regex: city, $options: "i" };
    }

    if (minFee || maxFee) {
      profileFilter["consultationFee.amount"] = {};
      if (minFee) profileFilter["consultationFee.amount"].$gte = Number(minFee);
      if (maxFee) profileFilter["consultationFee.amount"].$lte = Number(maxFee);
    }

    if (minExperience) {
      profileFilter.yearsOfExperience = { $gte: Number(minExperience) };
    }

    // ── Step 3: Filter by availability on a specific date ───────
    if (availableOn) {
      const start = new Date(availableOn);
      start.setHours(0, 0, 0, 0);
      const end = new Date(availableOn);
      end.setHours(23, 59, 59, 999);

      // Find doctorIds that have at least one available slot on that date
      const availableDoctorIds = await DateSlot.distinct("doctor", {
        doctor: { $in: matchingDoctorIds },
        date:   { $gte: start, $lte: end },
        status: "available",
      });

      if (availableDoctorIds.length === 0) {
        return res.status(200).json({
          success: true,
          total: 0,
          page: Number(page),
          totalPages: 0,
          data: [],
          message: `No doctors available on ${availableOn}`,
        });
      }

      // Intersect with existing profile filter
      profileFilter.doctor = { $in: availableDoctorIds };
    }

    // ── Step 4: Count total before pagination ───────────────────
    const total = await DoctorProfile.countDocuments(profileFilter);
    const totalPages = Math.ceil(total / Number(limit));
    const skip = (Number(page) - 1) * Number(limit);

    // ── Step 5: Build sort ───────────────────────────────────────
    const sortObject = buildSortObject(sortBy);

    // For name sort we need to add a computed field via aggregation
    const isNameSort = sortBy === "name_asc" || sortBy === "name_desc";

    let profiles;

    if (isNameSort) {
      // Use aggregation pipeline to sort by doctor's full name
      profiles = await DoctorProfile.aggregate([
        { $match: profileFilter },
        {
          $lookup: {
            from: "doctors",
            localField: "doctor",
            foreignField: "_id",
            as: "doctorData",
          },
        },
        { $unwind: "$doctorData" },
        {
          $addFields: {
            _sortName: {
              $concat: ["$doctorData.firstName", " ", "$doctorData.lastName"],
            },
          },
        },
        { $sort: sortObject },
        { $skip: skip },
        { $limit: Number(limit) },
        {
          $project: {
            _sortName: 0, // Remove temp sort field from output
          },
        },
      ]);

      // Populate doctor ref manually after aggregation
      await DoctorProfile.populate(profiles, {
        path: "doctorData",
        select: "firstName lastName email specialization licenseNumber phone doctorId isApproved",
      });
    } else {
      profiles = await DoctorProfile.find(profileFilter)
        .populate(
          "doctor",
          "firstName lastName email specialization licenseNumber phone doctorId isApproved"
        )
        .sort(sortObject)
        .skip(skip)
        .limit(Number(limit));
    }

    // ── Step 6: Format response ──────────────────────────────────
    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages,
      limit: Number(limit),
      filters: {
        name:            name || null,
        specialization:  specialization || null,
        city:            city || null,
        minFee:          minFee ? Number(minFee) : null,
        maxFee:          maxFee ? Number(maxFee) : null,
        minExperience:   minExperience ? Number(minExperience) : null,
        availableOn:     availableOn || null,
        sortBy:          sortBy || "newest",
      },
      data: profiles,
    });
  } catch (error) {
    console.error("searchDoctors error:", error);
    return res.status(500).json({ success: false, message: "Server error during search." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Autocomplete doctor name suggestions (for search input)
// @route   GET /api/doctors/search/autocomplete?q=john
// @access  Private (doctor, admin)
// ───────────────────────────────────────────────────────────────
const autocomplete = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 2 characters.",
      });
    }

    const doctors = await Doctor.find({
      isApproved: true,
      isActive: true,
      role: "doctor",
      $or: [
        { firstName: { $regex: q, $options: "i" } },
        { lastName:  { $regex: q, $options: "i" } },
      ],
    })
      .select("doctorId firstName lastName specialization")
      .limit(8); // Return max 8 suggestions

    const suggestions = doctors.map((d) => ({
      doctorId:      d.doctorId,
      displayName:   `Dr. ${d.firstName} ${d.lastName}`,
      specialization: d.specialization,
    }));

    return res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("autocomplete error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get list of all distinct specializations (for filter dropdown)
// @route   GET /api/doctors/search/specializations
// @access  Private (doctor, admin)
// ───────────────────────────────────────────────────────────────
const getSpecializations = async (req, res) => {
  try {
    const specializations = await Doctor.distinct("specialization", {
      isApproved: true,
      isActive: true,
      role: "doctor",
    });

    return res.status(200).json({
      success: true,
      total: specializations.length,
      data: specializations.sort(), // Alphabetical order
    });
  } catch (error) {
    console.error("getSpecializations error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get list of all distinct cities (for filter dropdown)
// @route   GET /api/doctors/search/cities
// @access  Private (doctor, admin)
// ───────────────────────────────────────────────────────────────
const getCities = async (req, res) => {
  try {
    const cities = await DoctorProfile.distinct("affiliation.city", {
      "affiliation.city": { $ne: "" }, // Exclude empty city fields
    });

    return res.status(200).json({
      success: true,
      total: cities.length,
      data: cities.sort(),
    });
  } catch (error) {
    console.error("getCities error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get a single doctor's full public details by doctorId
// @route   GET /api/doctors/search/:doctorId
// @access  Private (doctor, admin)
// ───────────────────────────────────────────────────────────────
const getDoctorDetails = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const profile = await DoctorProfile.findOne({ doctorId }).populate(
      "doctor",
      "firstName lastName email specialization licenseNumber phone doctorId isApproved createdAt"
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Doctor ${doctorId} not found.`,
      });
    }

    // Also fetch today's available slots count as a bonus
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySlotCount = await DateSlot.countDocuments({
      doctorId,
      date:   { $gte: today, $lt: tomorrow },
      status: "available",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...profile.toObject(),
        todayAvailableSlots: todaySlotCount,
      },
    });
  } catch (error) {
    console.error("getDoctorDetails error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  searchDoctors,
  autocomplete,
  getSpecializations,
  getCities,
  getDoctorDetails,
};