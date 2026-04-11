// controllers/doctorController.js
const svc = require('../services/doctorService');

exports.listDoctors = async (req, res) => {
  try {
    const doctors = await svc.listDoctors(req.query.specialty);
    res.json({ success: true, data: doctors });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error listing doctors' });
  }
};

exports.getDoctorPublicProfile = async (req, res) => {
  try {
    const doctor = await svc.getDoctorPublicProfile(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching doctor' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const doctor = await svc.getDoctorOwnProfile(req.doctor.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const doctor = await svc.updateDoctorProfile(req.doctor.id, req.body);
    res.json({ success: true, data: doctor, message: 'Profile updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};

exports.getMyPatients = async (req, res) => {
  try {
    const patients = await svc.getDoctorPatientList(req.doctor.id);
    res.json({ success: true, data: patients });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching patients' });
  }
};
