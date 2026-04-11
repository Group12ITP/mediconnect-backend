// routes/patientAuthRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/patientAuthController');
const { protectPatient } = require('../middleware/patientAuthMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protectPatient, getMe);
router.post('/logout', protectPatient, logout);

module.exports = router;
