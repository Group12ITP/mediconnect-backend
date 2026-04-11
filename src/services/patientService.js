// services/patientService.js
const Patient = require('../models/Patient');
const PatientAppointment = require('../models/PatientAppointment');
const Prescription = require('../models/Prescription');
const Report = require('../models/Report');

const escapeRegex = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Get patient dashboard statistics.
 */
const getDashboardStats = async (patientId) => {
  const patient = await Patient.findById(patientId).select('name').lean();

  const [upcomingCount, completedCount, totalReports, activePrescriptions] = await Promise.all([
    PatientAppointment.countDocuments({
      patient: patientId,
      status: { $in: ['pending', 'confirmed'] },
    }),
    PatientAppointment.countDocuments({ patient: patientId, status: 'completed' }),
    Report.countDocuments({ patient: patientId }),
    patient?.name
      ? Prescription.countDocuments({
          $or: [
            { patient: patientId },
            { patientName: new RegExp(`^${escapeRegex(patient.name)}$`, 'i') },
          ],
          status: 'active',
        })
      : 0,
  ]);

  const upcomingAppointments = await PatientAppointment.find({
    patient: patientId,
    status: { $in: ['pending', 'confirmed'] },
  })
    .populate('doctor', 'name specialization hospital')
    .sort({ date: 1, time: 1 })
    .limit(6)
    .lean();

  return {
    stats: {
      upcomingAppointments: upcomingCount,
      totalReports,
      activePrescriptions,
      totalConsultations: completedCount,
    },
    upcomingAppointments,
  };
};

/**
 * Get patient's medical history — appointments + prescriptions linked by doctor name.
 */
const getMedicalHistory = async (patientId) => {
  const patient = await Patient.findById(patientId).select('name').lean();
  const nameExact = patient?.name ? new RegExp(`^${escapeRegex(patient.name)}$`, 'i') : null;

  const prescriptionQuery = nameExact
    ? { $or: [{ patient: patientId }, { patientName: nameExact }] }
    : { patient: patientId };

  const [appointments, prescriptions] = await Promise.all([
    PatientAppointment.find({ patient: patientId, status: 'completed' })
      .populate('doctor', 'name specialization')
      .sort({ date: -1 })
      .lean(),
    Prescription.find(prescriptionQuery)
      .populate('doctor', 'name specialization')
      .sort({ issuedAt: -1 })
      .lean(),
  ]);

  return { appointments, prescriptions };
};

/**
 * Update patient profile.
 */
const updatePatientProfile = async (patientId, updates) => {
  const allowed = ['name', 'phoneNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'address', 'medicalConditions', 'allergies'];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  const patient = await Patient.findByIdAndUpdate(patientId, { $set: filtered }, { new: true, runValidators: true })
    .select('-password');
  return patient;
};

/**
 * Get prescriptions for the patient (matched by name since Prescription has no patient ref).
 */
const getPatientPrescriptions = async (patientId) => {
  const patient = await Patient.findById(patientId).select('name').lean();
  if (!patient) return [];

  const nameExact = new RegExp(`^${escapeRegex(patient.name)}$`, 'i');
  return Prescription.find({
    $or: [{ patient: patientId }, { patientName: nameExact }],
  })
    .populate('doctor', 'name specialization licenseNumber')
    .sort({ issuedAt: -1 })
    .lean();
};

module.exports = { getDashboardStats, getMedicalHistory, updatePatientProfile, getPatientPrescriptions };
