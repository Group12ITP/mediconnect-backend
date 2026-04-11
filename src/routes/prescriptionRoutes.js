// routes/prescriptionRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDoctorInfo,
  getDoctorPatients,
  issuePrescription,
  getDoctorPrescriptions,
  getPrescriptionById,
  cancelPrescription,
  downloadPrescriptionPdf,
} = require('../controllers/prescriptionController');
const { protect } = require('../middleware/authMiddleware');

// All prescription routes are protected
router.use(protect);

const issuePrescriptionValidation = [
  body('patientName').notEmpty().withMessage('Patient name is required').trim(),
  body('medicines')
    .isArray({ min: 1 })
    .withMessage('At least one medicine is required'),
  body('medicines.*.name').notEmpty().withMessage('Medicine name is required'),
];

/**
 * GET  /api/prescriptions/doctor-info - Get logged-in doctor's info
 * GET  /api/prescriptions/patients    - Get patients list from appointments
 * GET  /api/prescriptions             - List all prescriptions (with filters)
 * POST /api/prescriptions             - Issue a new prescription
 * GET  /api/prescriptions/:id         - Get single prescription
 * PATCH /api/prescriptions/:id/cancel - Cancel a prescription
 * GET  /api/prescriptions/:id/pdf     - Download prescription PDF
 */
router.get('/doctor-info', getDoctorInfo);
router.get('/patients', getDoctorPatients);
router.get('/', getDoctorPrescriptions);
router.post('/', issuePrescriptionValidation, issuePrescription);
router.get('/:id', getPrescriptionById);
router.patch('/:id/cancel', cancelPrescription);
router.get('/:id/pdf', downloadPrescriptionPdf);

module.exports = router;
