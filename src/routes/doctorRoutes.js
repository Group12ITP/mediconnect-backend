// routes/doctorRoutes.js
const express = require('express');
const router = express.Router();
const {
  listDoctors,
  getDoctorPublicProfile,
  getMyProfile,
  updateMyProfile,
  getMyPatients,
} = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');

// Public
router.get('/', listDoctors);
router.get('/:id', getDoctorPublicProfile);

// Doctor-protected
router.get('/me/profile', protect, getMyProfile);
router.put('/me/profile', protect, updateMyProfile);
router.get('/me/patients', protect, getMyPatients);

module.exports = router;
