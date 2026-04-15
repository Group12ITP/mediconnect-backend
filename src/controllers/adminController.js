const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Pharmacist = require("../models/Pharmacist");
const Admin = require("../models/Admin");
const PatientAppointment = require("../models/PatientAppointment");

const ROLE_MODEL_MAP = {
  doctor: Doctor,
  patient: Patient,
  pharmacist: Pharmacist,
  admin: Admin,
};

const sanitizeByRole = (role, user) => {
  if (role === "doctor") {
    return {
      id: user._id,
      role,
      name: user.name,
      email: user.email,
      specialization: user.specialization,
      licenseNumber: user.licenseNumber,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
  if (role === "patient") {
    return {
      id: user._id,
      role,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
  if (role === "pharmacist") {
    return {
      id: user._id,
      role,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      licenseNumber: user.licenseNumber,
      isApproved: user.isApproved,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
  return {
    id: user._id,
    role,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
};

exports.getOverview = async (req, res) => {
  try {
    const [
      doctorsCount,
      patientsCount,
      pharmacistsCount,
      adminsCount,
      pendingDoctors,
      pendingPharmacists,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      cancelledAppointments,
      paidAppointments,
    ] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      Pharmacist.countDocuments(),
      Admin.countDocuments(),
      Doctor.countDocuments({ isVerified: false }),
      Pharmacist.countDocuments({ isApproved: false }),
      PatientAppointment.countDocuments(),
      PatientAppointment.countDocuments({ status: "pending" }),
      PatientAppointment.countDocuments({ status: "completed" }),
      PatientAppointment.countDocuments({ status: "cancelled" }),
      PatientAppointment.find({ paymentStatus: "paid" }).select("consultationFee createdAt"),
    ]);

    const totalRevenue = paidAppointments.reduce((sum, item) => sum + (item.consultationFee || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        users: {
          doctors: doctorsCount,
          patients: patientsCount,
          pharmacists: pharmacistsCount,
          admins: adminsCount,
        },
        verifications: {
          pendingDoctors,
          pendingPharmacists,
        },
        operations: {
          totalAppointments,
          pendingAppointments,
          completedAppointments,
          cancelledAppointments,
        },
        finance: {
          totalRevenue,
          paidTransactions: paidAppointments.length,
        },
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({ success: false, message: "Failed to load admin overview." });
  }
};

exports.listUsersByRole = async (req, res) => {
  try {
    const role = String(req.params.role || "").toLowerCase();
    const Model = ROLE_MODEL_MAP[role];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid role." });

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || "").trim();

    const filter = {};
    if (search) {
      if (role === "pharmacist") {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      } else {
        filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
      }
    }

    const total = await Model.countDocuments(filter);
    const rows = await Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);

    return res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: rows.map((row) => sanitizeByRole(role, row)),
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch users." });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const role = String(req.params.role || "").toLowerCase();
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be a boolean." });
    }
    if (role === "admin" && String(req.admin.id) === String(id) && !isActive) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own admin account." });
    }

    const Model = ROLE_MODEL_MAP[role];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid role." });

    const updated = await Model.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "User not found." });

    return res.status(200).json({ success: true, data: sanitizeByRole(role, updated) });
  } catch (error) {
    console.error("Admin update status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update user status." });
  }
};

exports.listPendingDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isVerified: false }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: doctors.map((doctor) => sanitizeByRole("doctor", doctor)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch pending doctors." });
  }
};

exports.verifyDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });

    doctor.isVerified = true;
    doctor.isActive = true;
    await doctor.save();

    return res.status(200).json({ success: true, data: sanitizeByRole("doctor", doctor) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to verify doctor." });
  }
};

exports.approvePharmacistByAdmin = async (req, res) => {
  try {
    const pharmacist = await Pharmacist.findById(req.params.id);
    if (!pharmacist) return res.status(404).json({ success: false, message: "Pharmacist not found." });

    pharmacist.isApproved = true;
    pharmacist.isActive = true;
    await pharmacist.save();

    return res.status(200).json({ success: true, data: sanitizeByRole("pharmacist", pharmacist) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to approve pharmacist." });
  }
};

exports.getFinancialTransactions = async (req, res) => {
  try {
    const rows = await PatientAppointment.find({
      paymentStatus: { $in: ["paid", "refunded", "failed", "pending"] },
    })
      .populate("patient", "name email")
      .populate("doctor", "name email specialization")
      .sort({ createdAt: -1 })
      .limit(200);

    const data = rows.map((item) => ({
      id: item._id,
      appointmentId: item.appointmentId,
      createdAt: item.createdAt,
      paymentStatus: item.paymentStatus,
      consultationFee: item.consultationFee,
      stripePaymentIntentId: item.stripePaymentIntentId,
      stripeSessionId: item.stripeSessionId,
      patient: item.patient ? { id: item.patient._id, name: item.patient.name, email: item.patient.email } : null,
      doctor: item.doctor
        ? {
            id: item.doctor._id,
            name: item.doctor.name,
            email: item.doctor.email,
            specialization: item.doctor.specialization,
          }
        : null,
    }));

    return res.status(200).json({ success: true, total: data.length, data });
  } catch (error) {
    console.error("Admin financial transactions error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch financial transactions." });
  }
};
