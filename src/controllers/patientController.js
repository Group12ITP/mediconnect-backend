// controllers/patientController.js
const Patient = require('../models/Patient');
const { getDashboardStats, getMedicalHistory, updatePatientProfile, getPatientPrescriptions } = require('../services/patientService');

exports.getDashboard = async (req, res) => {
  try {
    const stats = await getDashboardStats(req.patient.id);
    res.json({ success: true, data: stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching dashboard' });
  }
};

exports.getMedicalHistory = async (req, res) => {
  try {
    const history = await getMedicalHistory(req.patient.id);
    res.json({ success: true, data: history });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching history' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const patient = await updatePatientProfile(req.patient.id, req.body);
    res.json({ success: true, data: patient, message: 'Profile updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};

exports.getPrescriptions = async (req, res) => {
  try {
    const prescriptions = await getPatientPrescriptions(req.patient.id);
    res.json({ success: true, data: prescriptions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching prescriptions' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const patient = await Patient.findById(req.patient.id).select('+password');
    
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    
    const isMatch = await patient.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    patient.password = newPassword;
    await patient.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
};

// Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const patient = await Patient.findById(req.patient.id);
    
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    
    // Delete related data (appointments, prescriptions, reports)
    await PatientAppointment.deleteMany({ patient: req.patient.id });
    await Report.deleteMany({ patient: req.patient.id });
    // Note: Prescriptions might not have patient ref, handle accordingly
    
    await patient.deleteOne();
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error deleting account' });
  }
};

// Get profile (if not exists)
exports.getProfile = async (req, res) => {
  try {
    const patient = await Patient.findById(req.patient.id).select('-password');
    res.json({ success: true, data: patient });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};