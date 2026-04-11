// routes/analyzeReportRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // inherits :patientId
const {
  createReport,
  getReports,
  getReferenceRanges,
} = require('../controllers/AnalyzeReportController');
const { protectPatient } = require('../middleware/patientAuthMiddleware');

// All routes are patient-protected
router.use(protectPatient);

// POST   /api/patient/:patientId/health-reports          — log a new metric
router.post('/', createReport);

// GET    /api/patient/:patientId/health-reports          — list / latest
router.get('/', getReports);

// GET    /api/patient/:patientId/health-reports/reference — clinical thresholds
router.get('/reference', getReferenceRanges);



module.exports = router;
