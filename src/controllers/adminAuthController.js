const Admin = require("../models/Admin");

const sanitize = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: "admin",
  isActive: admin.isActive,
  lastLogin: admin.lastLogin,
});

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const existingCount = await Admin.countDocuments();
    if (existingCount > 0) {
      if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
        return res.status(403).json({
          success: false,
          message: "Admin registration is restricted. Provide a valid setup key.",
        });
      }
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Admin already exists with this email." });
    }

    const admin = await Admin.create({ name, email, password });
    const token = admin.getSignedJwtToken();
    return res.status(201).json({ success: true, token, admin: sanitize(admin) });
  } catch (error) {
    console.error("Admin register error:", error);
    return res.status(500).json({ success: false, message: "Server error during admin registration." });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");
    if (!admin) return res.status(401).json({ success: false, message: "Invalid credentials." });
    if (!admin.isActive) return res.status(403).json({ success: false, message: "Admin account is deactivated." });

    const ok = await admin.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials." });

    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = admin.getSignedJwtToken();
    return res.status(200).json({ success: true, token, admin: sanitize(admin) });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, message: "Server error during admin login." });
  }
};

exports.getAdminMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.status(200).json({ success: true, admin: sanitize(admin) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
