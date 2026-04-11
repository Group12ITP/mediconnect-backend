const { validationResult } = require("express-validator");
const Pharmacist = require("../models/Pharmacist");
const {
  generateToken,
  generateResetToken,
  verifyToken,
} = require("../../utils/jwtHelper");
const {
  sendPharmacistWelcomeEmail,
  sendPharmacistApprovalEmail,
  sendPasswordResetEmail,
} = require("../../utils/emailService");

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

// ── Helper: Safe pharmacist response ───────────────────────────
const sanitize = (p) => ({
  id: p._id,
  pharmacistId: p.pharmacistId,
  firstName: p.firstName,
  lastName: p.lastName,
  email: p.email,
  role: p.role,
  licenseNumber: p.licenseNumber,
  phone: p.phone,
  pharmacy: p.pharmacy,
  isApproved: p.isApproved,
  isActive: p.isActive,
  createdAt: p.createdAt,
});

// ───────────────────────────────────────────────────────────────
// @desc    Register new pharmacist
// @route   POST /api/pharmacy/auth/register
// @access  Public
// ───────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;

  try {
    const { firstName, lastName, email, password, licenseNumber, phone } =
      req.body;

    const existing = await Pharmacist.findOne({
      $or: [{ email }, { licenseNumber }],
    });

    if (existing) {
      const field = existing.email === email ? "email" : "license number";
      return res.status(409).json({
        success: false,
        message: `A pharmacist with this ${field} already exists.`,
      });
    }

    const pharmacist = await Pharmacist.create({
      firstName,
      lastName,
      email,
      password,
      licenseNumber,
      phone,
    });

    sendPharmacistWelcomeEmail(
      pharmacist.email,
      `${pharmacist.firstName} ${pharmacist.lastName}`,
    );

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Your account is pending admin approval.",
      data: sanitize(pharmacist),
    });
  } catch (error) {
    console.error("Pharmacist register error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Pharmacist login
// @route   POST /api/pharmacy/auth/login
// @access  Public
// ───────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;

  try {
    const { email, password } = req.body;

    const pharmacist = await Pharmacist.findOne({ email }).select(
      "+password +tokenVersion",
    );

    if (!pharmacist) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const isMatch = await pharmacist.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    if (!pharmacist.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }

    if (!pharmacist.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval.",
      });
    }

    const token = generateToken({
      id: pharmacist._id,
      pharmacistId: pharmacist.pharmacistId,
      role: "pharmacist",
      tokenVersion: pharmacist.tokenVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      data: sanitize(pharmacist),
    });
  } catch (error) {
    console.error("Pharmacist login error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Get own profile
// @route   GET /api/pharmacy/auth/me
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const pharmacist = await Pharmacist.findById(req.user._id);
    return res.status(200).json({ success: true, data: sanitize(pharmacist) });
  } catch (error) {
    console.error("Pharmacist getMe error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Logout all devices
// @route   POST /api/pharmacy/auth/logout-all
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const logoutAll = async (req, res) => {
  try {
    await Pharmacist.findByIdAndUpdate(req.user._id, {
      $inc: { tokenVersion: 1 },
    });
    return res
      .status(200)
      .json({ success: true, message: "Logged out from all devices." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Forgot password
// @route   POST /api/pharmacy/auth/forgot-password
// @access  Public
// ───────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;

  try {
    const { email } = req.body;
    const pharmacist = await Pharmacist.findOne({ email });

    const generic = {
      success: true,
      message:
        "If an account with that email exists, a reset link has been sent.",
    };

    if (!pharmacist) return res.status(200).json(generic);

    const resetToken = generateResetToken({
      id: pharmacist._id,
      role: "pharmacist",
    });
    await sendPasswordResetEmail(
      pharmacist.email,
      `${pharmacist.firstName} ${pharmacist.lastName}`,
      resetToken,
      "pharmacist",
    );

    return res.status(200).json(generic);
  } catch (error) {
    console.error("Pharmacist forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Reset password via token
// @route   POST /api/pharmacy/auth/reset-password
// @access  Public
// ───────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;

  try {
    const { token, newPassword } = req.body;

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset token." });
    }

    const pharmacist = await Pharmacist.findById(decoded.id).select(
      "+tokenVersion",
    );
    if (!pharmacist) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid reset token." });
    }

    pharmacist.password = newPassword;
    pharmacist.tokenVersion += 1;
    await pharmacist.save();

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Pharmacist resetPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Change password (logged in)
// @route   PUT /api/pharmacy/auth/change-password
// @access  Private (pharmacist)
// ───────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;

  try {
    const { currentPassword, newPassword } = req.body;
    const pharmacist = await Pharmacist.findById(req.user._id).select(
      "+password +tokenVersion",
    );

    const isMatch = await pharmacist.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect." });
    }

    pharmacist.password = newPassword;
    pharmacist.tokenVersion += 1;
    await pharmacist.save();

    const newToken = generateToken({
      id: pharmacist._id,
      pharmacistId: pharmacist.pharmacistId,
      role: "pharmacist",
      tokenVersion: pharmacist.tokenVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      token: newToken,
    });
  } catch (error) {
    console.error("Pharmacist changePassword error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Admin approves pharmacist
// @route   PATCH /api/pharmacy/auth/approve/:id
// @access  Private (admin)
// ───────────────────────────────────────────────────────────────
const approvePharmacist = async (req, res) => {
  try {
    const pharmacist = await Pharmacist.findById(req.params.id);

    if (!pharmacist) {
      return res
        .status(404)
        .json({ success: false, message: "Pharmacist not found." });
    }

    if (pharmacist.isApproved) {
      return res
        .status(400)
        .json({ success: false, message: "Pharmacist is already approved." });
    }

    pharmacist.isApproved = true;
    await pharmacist.save();

    sendPharmacistApprovalEmail(
      pharmacist.email,
      `${pharmacist.firstName} ${pharmacist.lastName}`,
    );

    return res.status(200).json({
      success: true,
      message: `${pharmacist.firstName} ${pharmacist.lastName} (${pharmacist.pharmacistId}) approved.`,
      data: sanitize(pharmacist),
    });
  } catch (error) {
    console.error("approvePharmacist error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ───────────────────────────────────────────────────────────────
// @desc    Admin gets all pharmacists
// @route   GET /api/pharmacy/auth/all
// @access  Private (admin)
// ───────────────────────────────────────────────────────────────
const getAllPharmacists = async (req, res) => {
  try {
    const { isApproved, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (isApproved !== undefined) filter.isApproved = isApproved === "true";

    const total = await Pharmacist.countDocuments(filter);
    const pharmacists = await Pharmacist.find(filter)
      .populate("pharmacy", "name address city")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: pharmacists.map(sanitize),
    });
  } catch (error) {
    console.error("getAllPharmacists error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  approvePharmacist,
  getAllPharmacists,
};
