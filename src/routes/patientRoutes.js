const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getMedicalHistory,
  updateProfile,
  getPrescriptions,
  getProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/patientController');
const { protectPatient } = require('../middleware/patientAuthMiddleware');

router.use(protectPatient);

router.get('/dashboard', getDashboard);
router.get('/history', getMedicalHistory);
router.put('/profile', updateProfile);
router.get('/profile', getProfile);  // Add this
router.get('/prescriptions', getPrescriptions);
router.post('/change-password', changePassword);  // Add this
router.delete('/account', deleteAccount);  // Add this

module.exports = router;