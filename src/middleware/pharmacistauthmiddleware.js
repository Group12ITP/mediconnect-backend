const { verifyToken } = require("../../utils/jwtHelper");
const Doctor      = require("../models/Doctor");
const Pharmacist  = require("../models/Pharmacist");
const Patient     = require("../models/Patient");

// ── Model map: resolve correct model by role ────────────────────
const MODEL_MAP = {
  doctor:      Doctor,
  pharmacist:  Pharmacist,
  patient:     Patient,
  admin:       Doctor, // Admins use Doctor model with role:"admin"
};

// ───────────────────────────────────────────────────────────────
// protect — Verifies JWT, loads user from correct collection,
//           attaches to req.user regardless of role
// ───────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. Extract Bearer token
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // 2. Verify token
    const decoded = verifyToken(token);

    // 3. Look up user in the correct collection based on role
    const Model = MODEL_MAP[decoded.role];
    if (!Model) {
      return res.status(401).json({
        success: false,
        message: "Invalid token role.",
      });
    }

    const user = await Model.findById(decoded.id).select("+tokenVersion");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }

    // 4. Token version check (invalidates on logout-all / password change)
    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    // 5. Attach unified user object to req
    req.user = user;
    req.user.role = decoded.role; // ensure role is always available
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please log in again." });
    }
    return res.status(500).json({ success: false, message: "Authentication error." });
  }
};

// ───────────────────────────────────────────────────────────────
// restrictTo — Role-based access control
// Usage: restrictTo("admin", "pharmacist")
// ───────────────────────────────────────────────────────────────
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(", ")}.`,
      });
    }
    next();
  };
};

// ───────────────────────────────────────────────────────────────
// requireApproved — Blocks unapproved pharmacists / doctors
// Patients don't need approval so this passes them through
// ───────────────────────────────────────────────────────────────
const requireApproved = (req, res, next) => {
  // Patients have no isApproved field — always pass through
  if (req.user.role === "patient") return next();

  if (req.user.isApproved === false) {
    return res.status(403).json({
      success: false,
      message: "Your account is pending admin approval.",
    });
  }
  next();
};

module.exports = { protect, restrictTo, requireApproved };