// services/appointmentService.js
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const PatientAppointment = require('../models/PatientAppointment');
const Patient = require('../models/Patient');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');

/**
 * Get all doctors, optionally filtered by specialty.
 */
const getDoctors = async (specialty) => {
  const query = specialty ? { specialization: { $regex: specialty, $options: 'i' }, isActive: true } : { isActive: true };
  const doctors = await Doctor.find(query)
    .select('name specialization experience hospital licenseNumber doctorCode')
    .lean();
  return doctors;
};

/**
 * Get a single doctor's public profile.
 */
const getDoctorById = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId)
    .select('name specialization experience hospital licenseNumber phoneNumber')
    .lean();
  return doctor;
};

/**
 * Get doctor's available slots for a given month, minus already-booked ones.
 */
const getDoctorAvailability = async (doctorId, year, month) => {
  // All Availability docs for this doctor this month
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const availabilityDocs = await Availability.find({
    doctor: doctorId,
    date: { $regex: `^${prefix}` },
  }).lean();

  // Already booked slots for this doctor this month
  const booked = await PatientAppointment.find({
    doctor: doctorId,
    date: { $regex: `^${prefix}` },
    status: { $nin: ['cancelled', 'rejected'] },
  })
    .select('date time')
    .lean();

  const bookedMap = {};
  booked.forEach((b) => {
    if (!bookedMap[b.date]) bookedMap[b.date] = [];
    bookedMap[b.date].push(b.time);
  });

  // Build result: { 'YYYY-MM-DD': { slots: ['HH:MM',...], booked: ['HH:MM',...] } }
  const result = {};
  for (const doc of availabilityDocs) {
    const freeSlots = doc.slots
      .filter((s) => s.isActive)
      .map((s) => s.time);

    result[doc.date] = {
      slots: freeSlots,
      booked: bookedMap[doc.date] || [],
    };
  }

  return result;
};

/**
 * Create a Stripe Checkout Session for an appointment.
 * Returns { url, sessionId }.
 */
const createStripeCheckoutSession = async ({ patientId, doctorId, date, time, specialty, reason, type, fee, frontendUrl }) => {
  const doctor = await Doctor.findById(doctorId).select('name specialization').lean();
  if (!doctor) throw new Error('DOCTOR_NOT_FOUND');

  // Check slot is still free
  const existing = await PatientAppointment.findOne({
    doctor: doctorId, date, time,
    status: { $nin: ['cancelled', 'rejected'] },
  });
  if (existing) throw new Error('SLOT_TAKEN');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'lkr',
          product_data: {
            name: `Consultation with ${doctor.name}`,
            description: `${doctor.specialization} — ${date} at ${time}`,
          },
          unit_amount: Math.round(fee * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/book-appointment`,
    metadata: {
      patientId: String(patientId),
      doctorId: String(doctorId),
      date,
      time,
      specialty: specialty || doctor.specialization,
      reason: reason || '',
      type: type || 'Video',
      fee: String(fee),
    },
  });

  return { url: session.url, sessionId: session.id };
};

/**
 * After Stripe redirects back — verify payment and persist appointment.
 */
const verifyPaymentAndCreateAppointment = async (sessionId) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });

  if (session.payment_status !== 'paid') throw new Error('PAYMENT_NOT_COMPLETE');

  // Idempotency check
  const existing = await PatientAppointment.findOne({ stripeSessionId: sessionId });
  if (existing) return existing;

  const { patientId, doctorId, date, time, specialty, reason, type, fee } = session.metadata;

  const appointment = new PatientAppointment({
    patient: patientId,
    doctor: doctorId,
    date,
    time,
    specialty,
    reason,
    type,
    consultationFee: parseFloat(fee),
    stripeSessionId: sessionId,
    stripePaymentIntentId: session.payment_intent?.id || null,
    stripeReceiptUrl: session.payment_intent?.charges?.data?.[0]?.receipt_url || null,
    paymentStatus: 'paid',
    status: 'pending',
  });

  await appointment.save();
  return appointment;
};

/**
 * Get all appointments for a patient.
 */
const getPatientAppointments = async (patientId, status) => {
  const query = { patient: patientId };
  if (status && status !== 'all') query.status = status;

  const appointments = await PatientAppointment.find(query)
    .populate('doctor', 'name specialization hospital phoneNumber')
    .sort({ date: -1, time: -1 })
    .lean();

  return appointments;
};

/**
 * Cancel an appointment (patient side).
 */
const cancelAppointment = async (patientId, appointmentId) => {
  const apt = await PatientAppointment.findOne({ _id: appointmentId, patient: patientId });
  if (!apt) throw new Error('NOT_FOUND');
  if (['completed', 'cancelled', 'rejected'].includes(apt.status)) throw new Error('CANNOT_CANCEL');
  apt.status = 'cancelled';
  await apt.save();
  return apt;
};

/**
 * Get pending appointment requests for a doctor.
 */
const getDoctorAppointmentRequests = async (doctorId, status = 'pending') => {
  const query = { doctor: doctorId };
  if (status !== 'all') query.status = status;

  const appointments = await PatientAppointment.find(query)
    .populate('patient', 'name email phoneNumber gender dateOfBirth bloodGroup medicalConditions')
    .sort({ date: 1, time: 1 })
    .lean();

  return appointments;
};

/**
 * Doctor confirms an appointment — generates a Jitsi room ID.
 */
const confirmAppointment = async (doctorId, appointmentId) => {
  const apt = await PatientAppointment.findOne({ _id: appointmentId, doctor: doctorId });
  if (!apt) throw new Error('NOT_FOUND');
  if (apt.status !== 'pending') throw new Error('ALREADY_PROCESSED');
  apt.status = 'confirmed';
  apt.videoRoomId = `mediconnect-${uuidv4()}`;
  await apt.save();
  return apt;
};

/**
 * Doctor rejects an appointment request.
 */
const rejectAppointment = async (doctorId, appointmentId, reason) => {
  const apt = await PatientAppointment.findOne({ _id: appointmentId, doctor: doctorId });
  if (!apt) throw new Error('NOT_FOUND');
  if (apt.status !== 'pending') throw new Error('ALREADY_PROCESSED');
  apt.status = 'rejected';
  apt.cancellationReason = reason || '';
  await apt.save();
  return apt;
};

/**
 * Doctor marks appointment as completed.
 */
const completeAppointment = async (doctorId, appointmentId) => {
  const apt = await PatientAppointment.findOne({ _id: appointmentId, doctor: doctorId });
  if (!apt) throw new Error('NOT_FOUND');
  if (apt.status !== 'confirmed') throw new Error('NOT_CONFIRMED');
  apt.status = 'completed';
  await apt.save();
  return apt;
};

/**
 * Build receipt data for download.
 */
const getAppointmentReceipt = async (appointmentId, patientId) => {
  const apt = await PatientAppointment.findOne({ _id: appointmentId, patient: patientId })
    .populate('doctor', 'name specialization hospital licenseNumber')
    .populate('patient', 'name email phoneNumber')
    .lean();

  if (!apt) throw new Error('NOT_FOUND');
  return apt;
};

module.exports = {
  getDoctors,
  getDoctorById,
  getDoctorAvailability,
  createStripeCheckoutSession,
  verifyPaymentAndCreateAppointment,
  getPatientAppointments,
  cancelAppointment,
  getDoctorAppointmentRequests,
  confirmAppointment,
  rejectAppointment,
  completeAppointment,
  getAppointmentReceipt,
};
