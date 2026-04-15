// controllers/appointmentController.js
const svc = require('../services/appointmentService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await svc.getDoctors(req.query.specialty);
    res.json({ success: true, data: doctors });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

exports.getDoctorAvailability = async (req, res) => {
  try {
    const { year, month } = req.query;
    const availability = await svc.getDoctorAvailability(req.params.id, year, month);
    res.json({ success: true, data: availability });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching availability' });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { doctorId, date, time, specialty, reason, type, fee, frontendUrl } = req.body; // ADD frontendUrl
    if (!doctorId || !date || !time || !fee) {
      return res.status(400).json({ success: false, message: 'doctorId, date, time, fee are required' });
    }
    const result = await svc.createStripeCheckoutSession({
      patientId: req.patient.id,
      doctorId, date, time, specialty, reason, type, fee,
      frontendUrl: frontendUrl || FRONTEND_URL, // USE frontendUrl from request or fallback
    });
    res.json({ success: true, data: result });
  } catch (e) {
    if (e.message === 'SLOT_TAKEN') return res.status(409).json({ success: false, message: 'This slot was just booked by someone else' });
    if (e.message === 'DOCTOR_NOT_FOUND') return res.status(404).json({ success: false, message: 'Doctor not found' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error creating payment session' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ success: false, message: 'session_id required' });
    const appointment = await svc.verifyPaymentAndCreateAppointment(session_id);
    res.json({ success: true, data: appointment });
  } catch (e) {
    if (e.message === 'PAYMENT_NOT_COMPLETE') return res.status(402).json({ success: false, message: 'Payment not completed' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error verifying payment' });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await svc.getPatientAppointments(req.patient.id, req.query.status);
    res.json({ success: true, data: appointments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching appointments' });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const apt = await svc.cancelAppointment(req.patient.id, req.params.id, req.body.reason);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (e.message === 'CANNOT_CANCEL') return res.status(400).json({ success: false, message: 'Appointment cannot be cancelled' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error cancelling appointment' });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: 'date and time are required' });
    const apt = await svc.rescheduleAppointment(req.patient.id, req.params.id, date, time);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (e.message === 'CANNOT_RESCHEDULE') return res.status(400).json({ success: false, message: 'Appointment cannot be rescheduled in its current status' });
    if (e.message === 'SLOT_TAKEN') return res.status(409).json({ success: false, message: 'The selected slot is already booked' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error rescheduling appointment' });
  }
};


exports.getDoctorRequests = async (req, res) => {
  try {
    const requests = await svc.getDoctorAppointmentRequests(req.doctor.id, req.query.status);
    res.json({ success: true, data: requests });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching requests' });
  }
};

exports.confirmAppointment = async (req, res) => {
  try {
    const apt = await svc.confirmAppointment(req.doctor.id, req.params.id);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ success: false, message: 'Appointment already processed' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error confirming appointment' });
  }
};

exports.rejectAppointment = async (req, res) => {
  try {
    const apt = await svc.rejectAppointment(req.doctor.id, req.params.id, req.body.reason);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ success: false, message: 'Appointment already processed' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error rejecting appointment' });
  }
};

exports.completeAppointment = async (req, res) => {
  try {
    const apt = await svc.completeAppointment(req.doctor.id, req.params.id);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (e.message === 'NOT_CONFIRMED') return res.status(400).json({ success: false, message: 'Appointment not in confirmed state' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error completing appointment' });
  }
};

exports.getReceipt = async (req, res) => {
  try {
    const apt = await svc.getAppointmentReceipt(req.params.id, req.patient.id);
    res.json({ success: true, data: apt });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Appointment not found' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching receipt' });
  }
};