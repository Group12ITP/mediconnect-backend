// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDoctors,
  getDoctorAvailability,
  createCheckoutSession,
  verifyPayment,
  getMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getDoctorRequests,
  confirmAppointment,
  rejectAppointment,
  completeAppointment,
  getReceipt,
} = require('../controllers/appointmentController');

const { protectPatient } = require('../middleware/patientAuthMiddleware');
const { protect } = require('../middleware/authMiddleware'); // doctor auth

// ── Public ────────────────────────────────────────────────────
// List doctors (used on booking page)
router.get('/doctors', getDoctors);
router.get('/doctors/:id/availability', getDoctorAvailability);

// ── Patient routes ────────────────────────────────────────────
router.post('/checkout-session', protectPatient, createCheckoutSession);
router.get('/verify-payment', verifyPayment); // called after Stripe redirect (no auth needed, session_id is proof)
router.get('/mine', protectPatient, getMyAppointments);
router.patch('/:id/cancel', protectPatient, cancelAppointment);
router.patch('/:id/reschedule', protectPatient, rescheduleAppointment);
router.get('/:id/receipt', protectPatient, getReceipt);


// ── Doctor routes ─────────────────────────────────────────────
router.get('/requests', protect, getDoctorRequests);
router.patch('/:id/confirm', protect, confirmAppointment);
router.patch('/:id/reject', protect, rejectAppointment);
router.patch('/:id/complete', protect, completeAppointment);

module.exports = router;
