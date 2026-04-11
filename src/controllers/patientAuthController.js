// controllers/patientAuthController.js
const Patient = require('../models/Patient');
const { registerPatient, loginPatient } = require('../services/patientAuthService');

exports.register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber, dateOfBirth, gender, bloodGroup } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    }
    const patient = await registerPatient({ name, email, password, phoneNumber, dateOfBirth, gender, bloodGroup });
    const token = patient.getSignedJwtToken();
    res.status(201).json({
      success: true,
      token,
      patient: { id: patient._id, name: patient.name, email: patient.email, gender: patient.gender }
    });
  } catch (err) {
    if (err.message === 'EMAIL_TAKEN') {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }
    console.error('Patient register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { token, patient } = await loginPatient({ email, password });
    res.status(200).json({
      success: true,
      token,
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        phoneNumber: patient.phoneNumber,
      }
    });
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS' || err.message === 'MISSING_CREDENTIALS') {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }
    console.error('Patient login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const patient = await Patient.findById(req.patient.id).select('-password');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.status(200).json({ success: true, patient });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
