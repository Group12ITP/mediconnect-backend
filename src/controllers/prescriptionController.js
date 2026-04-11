// controllers/prescriptionController.js
const { validationResult } = require('express-validator');
const Doctor = require('../models/Doctor');
const prescriptionService = require('../services/prescriptionService');

/**
 * @desc    Get logged-in doctor's info (for prescription header)
 * @route   GET /api/prescriptions/doctor-info
 * @access  Private (Doctor)
 */
exports.getDoctorInfo = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctor.id).lean();
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        name: doctor.name,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        hospital: doctor.hospital,
        qualification: doctor.qualification,
      },
    });
  } catch (error) {
    console.error('getDoctorInfo error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching doctor info' });
  }
};

/**
 * @desc    Get list of patients this doctor has seen (from appointments)
 * @route   GET /api/prescriptions/patients
 * @access  Private (Doctor)
 */
exports.getDoctorPatients = async (req, res) => {
  try {
    const patients = await prescriptionService.getDoctorPatients(req.doctor.id);
    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error('getDoctorPatients error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching patients' });
  }
};

/**
 * @desc    Issue a new prescription
 * @route   POST /api/prescriptions
 * @access  Private (Doctor)
 * @body    { patientName, patientAge, patientGender, patientBloodGroup, appointmentId, medicines, notes, signatureData }
 */
// controllers/prescriptionController.js
// Update the issuePrescription function to accept patientId

exports.issuePrescription = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      patientId,        // Added this
      patientName,
      patientAge,
      patientGender,
      patientBloodGroup,
      appointmentId,
      medicines,
      notes,
      signatureData,
    } = req.body;

    // Either patientId OR patientName is required
    if (!patientId && !patientName) {
      return res.status(400).json({ success: false, message: 'Either patientId or patientName is required' });
    }
    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one medicine is required' });
    }

    const prescription = await prescriptionService.issuePrescription({
      doctorId: req.doctor.id,
      patientId,        // Pass patientId
      patientName,
      patientAge,
      patientGender,
      patientBloodGroup,
      appointmentId,
      medicines,
      notes,
      signatureData,
    });

    res.status(201).json({
      success: true,
      message: `Prescription ${prescription.prescriptionId} issued successfully`,
      data: {
        prescriptionId: prescription.prescriptionId,
        id: prescription._id,
        patientName: prescription.patientName,
        medicines: prescription.medicines,
        issuedAt: prescription.issuedAt,
      },
    });
  } catch (error) {
    console.error('issuePrescription error:', error);
    res.status(500).json({ success: false, message: 'Server error issuing prescription' });
  }
};
/**
 * @desc    Get all prescriptions issued by the logged-in doctor
 * @route   GET /api/prescriptions?search=&status=&startDate=&endDate=&page=&limit=
 * @access  Private (Doctor)
 */
exports.getDoctorPrescriptions = async (req, res) => {
  try {
    const { search, status, startDate, endDate, page, limit } = req.query;

    const result = await prescriptionService.getDoctorPrescriptions(req.doctor.id, {
      search,
      status,
      startDate,
      endDate,
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('getDoctorPrescriptions error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching prescriptions' });
  }
};

/**
 * @desc    Get a single prescription by its MongoDB ID
 * @route   GET /api/prescriptions/:id
 * @access  Private (Doctor)
 */
exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.doctor.id, req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    res.status(200).json({ success: true, data: prescription });
  } catch (error) {
    console.error('getPrescriptionById error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Cancel a prescription
 * @route   PATCH /api/prescriptions/:id/cancel
 * @access  Private (Doctor)
 */
exports.cancelPrescription = async (req, res) => {
  try {
    const prescription = await prescriptionService.cancelPrescription(req.doctor.id, req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    res.status(200).json({ success: true, message: 'Prescription cancelled', data: prescription });
  } catch (error) {
    console.error('cancelPrescription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Download a prescription as PDF (doctor portal)
 * @route   GET /api/prescriptions/:id/pdf
 * @access  Private (Doctor)
 */
exports.downloadPrescriptionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prescriptionService.generatePrescriptionPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="prescription-${id}.pdf"`
    );

    doc.pipe(res);
    doc.end();
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res
        .status(404)
        .json({ success: false, message: 'Prescription not found' });
    }
    console.error('downloadPrescriptionPdf error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error generating PDF' });
    }
  }
};
