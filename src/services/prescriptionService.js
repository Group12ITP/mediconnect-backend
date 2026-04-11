// services/prescriptionService.js
const Prescription = require('../models/Prescription');
const PatientAppointment = require('../models/PatientAppointment'); // Changed from Appointment
const Patient = require('../models/Patient'); // You'll need to import this
const PDFDocument = require('pdfkit');

/**
 * Get all patients who have confirmed appointments with this doctor.
 * Now works with your PatientAppointment model that references Patient by ID
 */
const getDoctorPatients = async (doctorId) => {
  console.log('Fetching patients for doctor:', doctorId);
  
  // Get appointments with populated patient data
  const appointments = await PatientAppointment.find({
    doctor: doctorId,
    status: { $nin: ['cancelled', 'rejected'] },
  })
    .populate('patient', 'name age gender phone bloodGroup') // Populate patient details
    .sort({ date: -1, createdAt: -1 })
    .lean();

  console.log(`Found ${appointments.length} appointments`);

  if (appointments.length === 0) {
    return [];
  }

  // De-duplicate by patient ID
  const seen = new Set();
  const patients = [];

  for (const apt of appointments) {
    const patientId = apt.patient?._id?.toString();
    
    if (patientId && !seen.has(patientId)) {
      seen.add(patientId);
      
      patients.push({
        id: patientId,
        name: apt.patient?.name || 'Unknown Patient',
        age: apt.patient?.age || null,
        phone: apt.patient?.phone || null,
        gender: apt.patient?.gender || null,
        bloodGroup: apt.patient?.bloodGroup || null,
        lastVisit: apt.date,
        appointmentId: apt._id,
      });
    }
  }

  console.log(`Returning ${patients.length} unique patients`);
  return patients;
};

/**
 * Issue a new prescription.
 * Updated to handle patient by ID reference
 */
const issuePrescription = async ({
  doctorId,
  patientId,        // Added patientId
  patientName,
  patientAge,
  patientGender,
  patientBloodGroup,
  appointmentId,
  medicines,
  notes,
  signatureData,
}) => {
  // If patientId is provided, try to fetch patient details
  let finalPatientName = patientName;
  let finalPatientAge = patientAge;
  let finalPatientGender = patientGender;
  let finalPatientBloodGroup = patientBloodGroup;
  
  if (patientId && !patientName) {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(patientId).lean();
    if (patient) {
      finalPatientName = patient.name;
      finalPatientAge = patient.age;
      finalPatientGender = patient.gender;
      finalPatientBloodGroup = patient.bloodGroup;
    }
  }

  const prescription = new Prescription({
    doctor: doctorId,
    ...(patientId ? { patient: patientId } : {}),
    patientName: finalPatientName,
    patientAge: finalPatientAge || undefined,
    patientGender: finalPatientGender || undefined,
    patientBloodGroup: finalPatientBloodGroup || undefined,
    appointment: appointmentId || undefined,
    medicines,
    notes,
    signatureData: signatureData || null,
  });

  await prescription.save();
  return prescription;
};

// Rest of the functions remain the same...
const getDoctorPrescriptions = async (doctorId, { search, status, startDate, endDate, page = 1, limit = 20 } = {}) => {
  const query = { doctor: doctorId };

  if (status) query.status = status;
  if (search) query.patientName = { $regex: search, $options: 'i' };

  if (startDate || endDate) {
    query.issuedAt = {};
    if (startDate) query.issuedAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.issuedAt.$lte = end;
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [prescriptions, total] = await Promise.all([
    Prescription.find(query)
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Prescription.countDocuments(query),
  ]);

  return {
    prescriptions,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  };
};

const getPrescriptionById = async (doctorId, prescriptionId) => {
  const prescription = await Prescription.findOne({
    _id: prescriptionId,
    doctor: doctorId,
  }).lean();

  return prescription || null;
};

const cancelPrescription = async (doctorId, prescriptionId) => {
  const prescription = await Prescription.findOneAndUpdate(
    { _id: prescriptionId, doctor: doctorId },
    { $set: { status: 'cancelled' } },
    { new: true }
  );

  return prescription;
};

const generatePrescriptionPdf = async (prescriptionId) => {
  const prescription = await Prescription.findById(prescriptionId)
    .populate('doctor', 'name specialization licenseNumber hospital qualification')
    .lean();

  if (!prescription) {
    const err = new Error('NOT_FOUND');
    throw err;
  }

  const doc = new PDFDocument({ margin: 50 });

  // Header
  doc
    .fontSize(20)
    .text(prescription.doctor?.name || 'Doctor', { align: 'left' })
    .moveDown(0.3);

  if (prescription.doctor?.specialization) {
    doc.fontSize(12).text(prescription.doctor.specialization);
  }
  if (prescription.doctor?.licenseNumber) {
    doc.fontSize(10).text(`Reg No: ${prescription.doctor.licenseNumber}`);
  }
  if (prescription.doctor?.hospital) {
    doc.fontSize(10).text(prescription.doctor.hospital);
  }

  doc.moveDown();
  doc
    .fontSize(10)
    .text(`Prescription ID: ${prescription.prescriptionId}`, { align: 'right' })
    .text(`Issued At: ${new Date(prescription.issuedAt).toLocaleString()}`, {
      align: 'right',
    });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Patient details
  doc.fontSize(12).text(`Patient: ${prescription.patientName}`);
  if (prescription.patientAge) {
    doc.text(`Age: ${prescription.patientAge}`);
  }
  if (prescription.patientGender) {
    doc.text(`Gender: ${prescription.patientGender}`);
  }
  if (prescription.patientBloodGroup) {
    doc.fontSize(10).text(`Blood Group: ${prescription.patientBloodGroup}`);
  }

  doc.moveDown();
  doc.fontSize(14).text('Medications', { underline: true });
  doc.moveDown(0.5);

  // Medicines table
  prescription.medicines.forEach((m, idx) => {
    doc
      .fontSize(12)
      .text(`${idx + 1}. ${m.name || ''}`, { continued: false })
      .moveDown(0.1);
    const details = [m.dosage, m.frequency, m.duration].filter(Boolean).join(' • ');
    if (details) {
      doc.fontSize(10).text(details);
    }
    doc.moveDown(0.4);
  });

  if (prescription.notes) {
    doc.moveDown();
    doc.fontSize(12).text('Notes', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).text(prescription.notes, { width: 500 });
  }

  // Signature
  doc.moveDown(2);
  const yBeforeSignature = doc.y;
  if (prescription.signatureData && prescription.signatureData.startsWith('data:image')) {
    try {
      const base64 = prescription.signatureData.split(',')[1];
      const imgBuffer = Buffer.from(base64, 'base64');
      doc.image(imgBuffer, 350, yBeforeSignature, { width: 150 });
      doc.moveDown(3);
    } catch {
      // ignore signature rendering errors
    }
  }
  doc
    .fontSize(10)
    .text('__________________________', 350, doc.y + 10)
    .text('Doctor Signature', 380, doc.y + 5);

  return doc;
};

module.exports = {
  getDoctorPatients,
  issuePrescription,
  getDoctorPrescriptions,
  getPrescriptionById,
  cancelPrescription,
  generatePrescriptionPdf,
};