// routes/patientRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getMedicalHistory,
  updateProfile,
  getPrescriptions,
} = require('../controllers/patientController');
const { protectPatient } = require('../middleware/patientAuthMiddleware');

router.use(protectPatient);

router.get('/dashboard', getDashboard);
router.get('/history', getMedicalHistory);
router.put('/profile', updateProfile);
router.get('/prescriptions', getPrescriptions);

module.exports = router;
