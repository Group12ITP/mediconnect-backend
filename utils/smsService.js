// utils/smsService.js - TextBee (Android-based - Truly Free & Unlimited)
const axios = require('axios');

const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY;
const TEXTBEE_DEVICE_ID = process.env.TEXTBEE_DEVICE_ID;
const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || 'https://api.textbee.dev/api/v1';

if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
  console.warn('[SMS] ⚠️ TextBee not configured. SMS will be disabled. Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID in .env');
}

/**
 * Send raw SMS via TextBee (your own Android phone)
 */
const sendSMS = async (to, body) => {
  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    console.warn('[SMS] TextBee credentials missing — skipping SMS');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!to || !body) {
    console.warn('[SMS] Missing phone or message');
    return { success: false, error: 'Missing parameters' };
  }

  try {
    const formattedNumber = to.startsWith('+') ? to : `+${to}`;

    const response = await axios.post(
      `${TEXTBEE_API_URL}/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`,
      {
        recipients: [formattedNumber],
        message: body,
      },
      {
        headers: {
          'x-api-key': TEXTBEE_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
      }
    );

    if (response.data?.success !== false) {
      console.log(`[SMS] ✅ Sent successfully to ${formattedNumber}`);
      return { success: true };
    } else {
      console.warn(`[SMS] ⚠️ TextBee response:`, response.data);
      return { success: false, error: response.data?.error || 'Unknown' };
    }
  } catch (err) {
    console.error(`[SMS] ❌ Failed to send to ${to}:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Format Sri Lankan phone numbers (0xxxxxxxxx → +94xxxxxxxxx)
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.startsWith('0')) {
    cleaned = '+94' + cleaned.substring(1);
  }
  return cleaned;
};

// ─── Your existing notification functions (kept exactly as before) ─────────────────────

const sendBookingConfirmedSMS = async (patient, doctor, apt) => {
  const phone = formatPhoneNumber(patient?.phoneNumber);
  if (!phone) return;

  const msg = `🏥 MEDICONNECT - Appointment Booked ✅\n\n` +
    `📋 ID: ${apt.appointmentId}\n` +
    `👨‍⚕️ Doctor: Dr. ${doctor?.name || 'N/A'}\n` +
    `📅 Date: ${apt.date}\n` +
    `⏰ Time: ${apt.time}\n` +
    `💳 Fee: LKR ${apt.consultationFee}\n\n` +
    `Status: Pending doctor confirmation`;

  await sendSMS(phone, msg);
};

const sendDoctorConfirmSMS = async (patient, doctor, apt) => {
  const phone = formatPhoneNumber(patient?.phoneNumber);
  if (!phone) return;

  const msg = `🏥 MEDICONNECT - Appointment Confirmed ✅\n\n` +
    `📋 ID: ${apt.appointmentId}\n` +
    `👨‍⚕️ Doctor: Dr. ${doctor?.name || 'N/A'}\n` +
    `📅 Date: ${apt.date}\n` +
    `⏰ Time: ${apt.time}\n\n` +
    `🎥 Join: mediconnect.app/room/${apt.videoRoomId || 'N/A'}`;

  await sendSMS(phone, msg);
};

const sendDoctorRejectSMS = async (patient, doctor, apt, reason) => {
  const phone = formatPhoneNumber(patient?.phoneNumber);
  if (!phone) return;

  const msg = `🏥 MEDICONNECT - Appointment Declined ❌\n\n` +
    `📋 ID: ${apt.appointmentId}\n` +
    `Reason: ${reason || 'Doctor unavailable'}\n\n` +
    `Refund will be processed soon.`;

  await sendSMS(phone, msg);
};

const sendCompletedSMS = async (patient, doctor, apt) => {
  const patientPhone = formatPhoneNumber(patient?.phoneNumber);
  if (patientPhone) {
    await sendSMS(patientPhone, `🏥 Consultation Completed ✔️\nID: ${apt.appointmentId}\nThank you for choosing MediConnect!`);
  }

  const doctorPhone = formatPhoneNumber(doctor?.phoneNumber);
  if (doctorPhone) {
    await sendSMS(doctorPhone, `🏥 Consultation Completed ✔️\nPatient: ${patient?.name || 'N/A'}\nID: ${apt.appointmentId}`);
  }
};

const sendCancelledSMS = async (patient, doctor, apt, reason) => {
  const doctorPhone = formatPhoneNumber(doctor?.phoneNumber);
  if (doctorPhone) {
    await sendSMS(doctorPhone, `Appointment Cancelled ❌\nID: ${apt.appointmentId}`);
  }

  const patientPhone = formatPhoneNumber(patient?.phoneNumber);
  if (patientPhone) {
    await sendSMS(patientPhone, `Your appointment ${apt.appointmentId} cancelled.`);
  }
};

const sendRescheduledSMS = async (patient, doctor, apt, oldDate, oldTime) => {
  const doctorPhone = formatPhoneNumber(doctor?.phoneNumber);
  if (doctorPhone) {
    await sendSMS(doctorPhone, `Rescheduled 🔄\nID: ${apt.appointmentId}\nNew: ${apt.date} ${apt.time}`);
  }

  const patientPhone = formatPhoneNumber(patient?.phoneNumber);
  if (patientPhone) {
    await sendSMS(patientPhone, `Appointment rescheduled to ${apt.date} ${apt.time}`);
  }
};

const sendNewRequestSMS = async (patient, doctor, apt) => {
  const doctorPhone = formatPhoneNumber(doctor?.phoneNumber);
  if (!doctorPhone) return;

  const msg = `🏥 New Appointment Request 🔔\nID: ${apt.appointmentId}\nPatient: ${patient?.name}\n${apt.date} ${apt.time}`;
  await sendSMS(doctorPhone, msg);
};

// Export the same functions you were already using
module.exports = {
  sendSMS,
  sendBookingConfirmedSMS,
  sendDoctorConfirmSMS,
  sendDoctorRejectSMS,
  sendCompletedSMS,
  sendCancelledSMS,
  sendRescheduledSMS,
  sendNewRequestSMS,
};