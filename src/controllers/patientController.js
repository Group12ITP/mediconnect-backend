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
