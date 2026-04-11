// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getMyReports,
  getPatientReportsForDoctor,
  deleteReport,
  downloadReport,
} = require('../controllers/reportController');
const { protectPatient } = require('../middleware/patientAuthMiddleware');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

// Patient uploads & views own reports
router.post('/upload', protectPatient, upload.single('report'), uploadReport);
router.get('/mine', protectPatient, getMyReports);
router.delete('/:id', protectPatient, deleteReport);

// Doctor views a patient's reports
router.get('/patient/:patientId', protect, getPatientReportsForDoctor);

/**
 * Download — patient OR doctor can download.
 * Uses the JWT role claim to avoid the "headers already sent" bug
 * that occurs when chaining two separate auth middlewares.
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'doctor') {
      const doctor = await Doctor.findById(decoded.id);
      if (!doctor || !doctor.isActive) return res.status(401).json({ success: false, message: 'Not authorized' });
      req.doctor = { id: decoded.id, email: decoded.email, role: decoded.role };
    } else {
      // patient (or any non-doctor role)
      const patient = await Patient.findById(decoded.id);
      if (!patient) return res.status(401).json({ success: false, message: 'Not authorized' });
      req.patient = { id: decoded.id, email: decoded.email };
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}, downloadReport);

module.exports = router;
