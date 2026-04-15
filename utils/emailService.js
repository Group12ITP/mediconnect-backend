// utils/emailService.js
const nodemailer = require("nodemailer");

// Create transporter with proper configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // These options help with connection issues
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email service error:", error.message);
    console.error("   Please check:");
    console.error("   1. EMAIL_USER in .env:", process.env.EMAIL_USER);
    console.error("   2. EMAIL_PASS (app password with spaces)");
    console.error("   3. 2-Step Verification is ON in Google Account");
    console.error("   4. App password generated at https://myaccount.google.com/apppasswords");
  } else {
    console.log("✅ Email service ready to send notifications");
  }
});

// ── Pharmacist welcome email ────────────────────────────────────
const sendPharmacistWelcomeEmail = async (toEmail, name) => {
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Welcome to MediConnect — Pharmacist Registration Received",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#2c7be5;">Welcome, ${name}!</h2>
          <p>Thank you for registering as a pharmacist on <strong>MediConnect</strong>.</p>
          <p>Your account is <strong>pending admin approval</strong>. You'll receive an email once approved.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">If you did not create this account, please ignore this email.</p>
        </div>`,
    });
    console.log(`📧 Pharmacist welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error("Pharmacist welcome email failed:", err.message);
  }
};

// ── Pharmacist approval email ───────────────────────────────────
const sendPharmacistApprovalEmail = async (toEmail, name) => {
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Your MediConnect Pharmacist Account Has Been Approved!",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#28a745;">Account Approved, ${name}!</h2>
          <p>Your pharmacist account on <strong>MediConnect</strong> has been approved.</p>
          <p>You can now <a href="${process.env.FRONTEND_URL}/pharmacist/login" style="color:#2c7be5;">log in</a>
             and set up your pharmacy profile.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">MediConnect Support Team</p>
        </div>`,
    });
    console.log(`📧 Pharmacist approval email sent to ${toEmail}`);
  } catch (err) {
    console.error("Pharmacist approval email failed:", err.message);
  }
};

// ── Patient welcome email ───────────────────────────────────────
const sendPatientWelcomeEmail = async (toEmail, name) => {
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Welcome to MediConnect!",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#2c7be5;">Welcome, ${name}!</h2>
          <p>Your patient account on <strong>MediConnect</strong> has been created successfully.</p>
          <p>You can now <a href="${process.env.FRONTEND_URL}/login" style="color:#2c7be5;">log in</a>
             to book appointments and manage your health.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">MediConnect Support Team</p>
        </div>`,
    });
    console.log(`📧 Patient welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error("Patient welcome email failed:", err.message);
  }
};

// ── Password reset email (shared for all roles) ─────────────────
const sendPasswordResetEmail = async (toEmail, name, resetToken, role) => {
  try {
    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&role=${role}`;
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Password Reset Request — MediConnect",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#e74c3c;">Password Reset Request</h2>
          <p>Hello, ${name}.</p>
          <p>Click below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
          <a href="${resetURL}"
             style="display:inline-block;padding:10px 20px;background:#2c7be5;
                    color:#fff;text-decoration:none;border-radius:5px;margin:16px 0;">
            Reset Password
          </a>
          <p>If you did not request this, please ignore this email.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">MediConnect Support Team</p>
        </div>`,
    });
    console.log(`📧 Password reset email sent to ${toEmail}`);
  } catch (err) {
    console.error("Password reset email failed:", err.message);
  }
};

// ── Appointment: booking confirmed (patient) ───────────────────────────────
const sendBookingConfirmedEmail = async (patient, doctor, apt) => {
  if (!patient?.email) {
    console.log('⚠️ No patient email - skipping booking confirmation email');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: patient.email,
      subject: `Appointment Booked — ${apt.appointmentId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">🏥 MediConnect</h1>
            <p style="color:#ccfbf1;margin:8px 0 0;">Appointment Confirmation</p>
          </div>
          <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#374151;">Hello, ${patient.name}! 👋</h2>
            <p style="color:#6b7280;">Your appointment has been booked successfully and is awaiting doctor confirmation.</p>
            <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Doctor</td><td style="font-weight:600;">Dr. ${doctor?.name || 'N/A'}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Specialty</td><td style="font-weight:600;">${apt.specialty || doctor?.specialization || 'N/A'}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Date &amp; Time</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Fee Paid</td><td style="color:#0d9488;font-weight:700;">LKR ${(apt.consultationFee || 0).toLocaleString()}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Status</td><td><span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-size:12px;">⏳ Pending Confirmation</span></td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;">You will receive another notification once the doctor confirms your appointment.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect • support@mediconnect.app</p>
          </div>
        </div>`,
    });
    console.log(`📧 Booking confirmed email sent to ${patient.email}`);
  } catch (err) {
    console.error('[Email] Booking confirmed failed:', err.message);
  }
};

// Notify doctor a new request arrived
const sendNewRequestEmail = async (patient, doctor, apt) => {
  if (!doctor?.email) {
    console.log('⚠️ No doctor email - skipping new request email');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: doctor.email,
      subject: `New Appointment Request — ${apt.appointmentId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">🏥 MediConnect</h1>
            <p style="color:#ccfbf1;margin:8px 0 0;">New Appointment Request</p>
          </div>
          <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#374151;">Hello, Dr. ${doctor.name}!</h2>
            <p style="color:#6b7280;">A patient has booked an appointment with you and is awaiting your confirmation.</p>
            <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Patient</td><td style="font-weight:600;">${patient?.name || 'N/A'}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Date &amp; Time</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Reason</td><td style="font-weight:600;">${apt.reason || 'Not specified'}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;">Please log in to your MediConnect portal to confirm or decline this request.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
          </div>
        </div>`,
    });
    console.log(`📧 New request email sent to ${doctor.email}`);
  } catch (err) {
    console.error('[Email] New request email failed:', err.message);
  }
};

// ── Appointment: doctor confirms (patient) ──────────────────────────────────
const sendDoctorConfirmEmail = async (patient, doctor, apt) => {
  if (!patient?.email) {
    console.log('⚠️ No patient email - skipping doctor confirm email');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: patient.email,
      subject: `✅ Appointment Confirmed — ${apt.appointmentId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#059669,#065f46);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;">🏥 MediConnect</h1>
            <p style="color:#a7f3d0;margin:8px 0 0;">Appointment Confirmed!</p>
          </div>
          <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#374151;">Great news, ${patient.name}! 🎉</h2>
            <p style="color:#6b7280;">Dr. <strong>${doctor?.name}</strong> has confirmed your appointment.</p>
            <div style="background:#ecfdf5;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Doctor</td><td style="font-weight:600;">Dr. ${doctor?.name}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Date &amp; Time</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Video Room</td><td style="color:#059669;font-weight:600;">Ready — join via MediConnect portal</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;">Log in to your MediConnect account to join the video consultation at the scheduled time.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
          </div>
        </div>`,
    });
    console.log(`📧 Doctor confirm email sent to ${patient.email}`);
  } catch (err) {
    console.error('[Email] Confirm email failed:', err.message);
  }
};

// ── Appointment: doctor rejects (patient) ───────────────────────────────────
const sendDoctorRejectEmail = async (patient, doctor, apt, reason) => {
  if (!patient?.email) {
    console.log('⚠️ No patient email - skipping doctor reject email');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: patient.email,
      subject: `Appointment Declined — ${apt.appointmentId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;">🏥 MediConnect</h1>
            <p style="color:#fecaca;margin:8px 0 0;">Appointment Declined</p>
          </div>
          <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#374151;">Hello, ${patient.name}</h2>
            <p style="color:#6b7280;">We're sorry. Dr. <strong>${doctor?.name}</strong> has declined your appointment request.</p>
            <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Date &amp; Time</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Reason</td><td style="color:#dc2626;">${reason || 'Doctor unavailable'}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;">Please book with another available doctor on the MediConnect platform.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
          </div>
        </div>`,
    });
    console.log(`📧 Doctor reject email sent to ${patient.email}`);
  } catch (err) {
    console.error('[Email] Reject email failed:', err.message);
  }
};

// ── Appointment: completed (patient only) ───────────────────────────────────────────
const sendCompletedEmail = async (patient, doctor, apt) => {
  if (!patient?.email) {
    console.log('⚠️ No patient email - skipping completed email');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediConnect" <${process.env.EMAIL_USER}>`,
      to: patient.email,
      subject: `✔️ Consultation Completed — ${apt.appointmentId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;">🏥 MediConnect</h1>
            <p style="color:#bfdbfe;margin:8px 0 0;">Consultation Completed</p>
          </div>
          <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#374151;">Thank you, ${patient.name}! ✔️</h2>
            <p style="color:#6b7280;">Your consultation with Dr. <strong>${doctor?.name}</strong> has been marked as completed.</p>
            <div style="background:#eff6ff;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Doctor</td><td style="font-weight:600;">Dr. ${doctor?.name}</td></tr>
                <tr><td style="color:#6b7280;padding:6px 0;">Date</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;">Thank you for using MediConnect. We hope you feel better soon!</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
          </div>
        </div>`,
    });
    console.log(`📧 Completed email sent to ${patient.email}`);
  } catch (err) {
    console.error('[Email] Completed email failed:', err.message);
  }
};

// ── Appointment: cancelled (doctor and patient notification) ────────────────────────────
const sendCancelledEmail = async (patient, doctor, apt, reason) => {
  // Send to doctor
  if (doctor?.email) {
    try {
      await transporter.sendMail({
        from: `"MediConnect" <${process.env.EMAIL_USER}>`,
        to: doctor.email,
        subject: `Appointment Cancelled — ${apt.appointmentId}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <div style="background:linear-gradient(135deg,#6b7280,#374151);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;">🏥 MediConnect</h1>
              <p style="color:#d1d5db;margin:8px 0 0;">Appointment Cancelled</p>
            </div>
            <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="color:#374151;">Hello, Dr. ${doctor.name}</h2>
              <p style="color:#6b7280;"><strong>${patient?.name}</strong> has cancelled their appointment.</p>
              <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                  <tr><td style="color:#6b7280;padding:6px 0;">Date &amp; Time</td><td style="font-weight:600;">${apt.date} at ${apt.time}</td></tr>
                  ${reason ? `<tr><td style="color:#6b7280;padding:6px 0;">Reason</td><td style="color:#dc2626;">${reason}</td></tr>` : ''}
                </table>
              </div>
              <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
            </div>
          </div>`,
      });
      console.log(`📧 Cancelled email sent to doctor ${doctor.email}`);
    } catch (err) {
      console.error('[Email] Cancelled doctor email failed:', err.message);
    }
  }
  
  // Send to patient
  if (patient?.email) {
    try {
      await transporter.sendMail({
        from: `"MediConnect" <${process.env.EMAIL_USER}>`,
        to: patient.email,
        subject: `Appointment Cancellation Confirmed — ${apt.appointmentId}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;">
            <h2 style="color:#374151;">Cancellation Confirmed</h2>
            <p style="color:#6b7280;">Your appointment <strong>${apt.appointmentId}</strong> on <strong>${apt.date} at ${apt.time}</strong> has been cancelled.</p>
            <p style="color:#9ca3af;font-size:11px;">© ${new Date().getFullYear()} MediConnect</p>
          </div>`,
      });
      console.log(`📧 Cancelled email sent to patient ${patient.email}`);
    } catch (err) {
      console.error('[Email] Cancelled patient email failed:', err.message);
    }
  }
};

// ── Appointment: rescheduled ────────────────────────────────────────────────
const sendRescheduledEmail = async (patient, doctor, apt, oldDate, oldTime) => {
  // Send to doctor
  if (doctor?.email) {
    try {
      await transporter.sendMail({
        from: `"MediConnect" <${process.env.EMAIL_USER}>`,
        to: doctor.email,
        subject: `Appointment Rescheduled — ${apt.appointmentId}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <div style="background:linear-gradient(135deg,#7c3aed,#4c1d95);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;">🏥 MediConnect</h1>
              <p style="color:#ddd6fe;margin:8px 0 0;">Appointment Rescheduled</p>
            </div>
            <div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="color:#374151;">Hello, Dr. ${doctor.name}</h2>
              <p style="color:#6b7280;"><strong>${patient?.name}</strong> has rescheduled their appointment.</p>
              <div style="background:#f5f3ff;border-radius:8px;padding:20px;margin:20px 0;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="color:#6b7280;padding:6px 0;">Appointment ID</td><td style="font-weight:600;">${apt.appointmentId}</td></tr>
                  <tr><td style="color:#6b7280;padding:6px 0;">Previous Slot</td><td style="text-decoration:line-through;color:#9ca3af;">${oldDate} at ${oldTime}</td></tr>
                  <tr><td style="color:#6b7280;padding:6px 0;">New Slot</td><td style="font-weight:600;color:#7c3aed;">${apt.date} at ${apt.time}</td></tr>
                </table>
              </div>
              <p style="color:#6b7280;font-size:13px;">The appointment is back in <strong>pending</strong> status awaiting your re-confirmation.</p>
              <p style="color:#9ca3af;font-size:11px;text-align:center;">© ${new Date().getFullYear()} MediConnect</p>
            </div>
          </div>`,
      });
      console.log(`📧 Rescheduled email sent to doctor ${doctor.email}`);
    } catch (err) {
      console.error('[Email] Rescheduled doctor email failed:', err.message);
    }
  }
  
  // Send to patient
  if (patient?.email) {
    try {
      await transporter.sendMail({
        from: `"MediConnect" <${process.env.EMAIL_USER}>`,
        to: patient.email,
        subject: `Reschedule Confirmed — ${apt.appointmentId}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;">
            <h2 style="color:#374151;">Appointment Rescheduled ✅</h2>
            <p style="color:#6b7280;">Your appointment <strong>${apt.appointmentId}</strong> has been moved to <strong>${apt.date} at ${apt.time}</strong>.</p>
            <p style="color:#6b7280;">It is now pending doctor re-confirmation.</p>
            <p style="color:#9ca3af;font-size:11px;">© ${new Date().getFullYear()} MediConnect</p>
          </div>`,
      });
      console.log(`📧 Rescheduled email sent to patient ${patient.email}`);
    } catch (err) {
      console.error('[Email] Rescheduled patient email failed:', err.message);
    }
  }
};

module.exports = {
  sendPharmacistWelcomeEmail,
  sendPharmacistApprovalEmail,
  sendPatientWelcomeEmail,
  sendPasswordResetEmail,
  // Appointment lifecycle
  sendBookingConfirmedEmail,
  sendNewRequestEmail,
  sendDoctorConfirmEmail,
  sendDoctorRejectEmail,
  sendCompletedEmail,
  sendCancelledEmail,
  sendRescheduledEmail,
};