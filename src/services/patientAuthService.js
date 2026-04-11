// services/patientAuthService.js
const Patient = require('../models/Patient');
const jwt = require('jsonwebtoken');

const registerPatient = async ({ name, email, password, phoneNumber, dateOfBirth, gender, bloodGroup }) => {
  const existing = await Patient.findOne({ email });
  if (existing) throw new Error('EMAIL_TAKEN');

  const patient = new Patient({ name, email, password, phoneNumber, dateOfBirth, gender, bloodGroup });
  await patient.save();
  return patient;
};

const loginPatient = async ({ email, password }) => {
  if (!email || !password) throw new Error('MISSING_CREDENTIALS');

  const patient = await Patient.findOne({ email }).select('+password');
  if (!patient) throw new Error('INVALID_CREDENTIALS');
  if (!patient.isActive) throw new Error('ACCOUNT_DEACTIVATED');

  const match = await patient.matchPassword(password);
  if (!match) throw new Error('INVALID_CREDENTIALS');

  patient.lastLogin = Date.now();
  await patient.save({ validateBeforeSave: false });

  const token = patient.getSignedJwtToken();
  return { token, patient };
};

module.exports = { registerPatient, loginPatient };
