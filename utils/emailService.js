const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Pharmacist welcome email ────────────────────────────────────
const sendPharmacistWelcomeEmail = async (toEmail, name) => {
  await transporter.sendMail({
    from: `"TeleMed Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Welcome to TeleMed — Pharmacist Registration Received",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#2c7be5;">Welcome, ${name}!</h2>
        <p>Thank you for registering as a pharmacist on <strong>TeleMed Platform</strong>.</p>
        <p>Your account is <strong>pending admin approval</strong>. You'll receive an email once approved.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">If you did not create this account, please ignore this email.</p>
      </div>`,
  }).catch((err) => console.error("Pharmacist welcome email failed:", err.message));
};

// ── Pharmacist approval email ───────────────────────────────────
const sendPharmacistApprovalEmail = async (toEmail, name) => {
  await transporter.sendMail({
    from: `"TeleMed Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your TeleMed Pharmacist Account Has Been Approved!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#28a745;">Account Approved, ${name}!</h2>
        <p>Your pharmacist account on <strong>TeleMed Platform</strong> has been approved.</p>
        <p>You can now <a href="${process.env.FRONTEND_URL}/pharmacist/login" style="color:#2c7be5;">log in</a>
           and set up your pharmacy profile.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">TeleMed Platform Support Team</p>
      </div>`,
  }).catch((err) => console.error("Pharmacist approval email failed:", err.message));
};

// ── Patient welcome email ───────────────────────────────────────
const sendPatientWelcomeEmail = async (toEmail, name) => {
  await transporter.sendMail({
    from: `"TeleMed Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Welcome to TeleMed Platform!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#2c7be5;">Welcome, ${name}!</h2>
        <p>Your patient account on <strong>TeleMed Platform</strong> has been created successfully.</p>
        <p>You can now <a href="${process.env.FRONTEND_URL}/login" style="color:#2c7be5;">log in</a>
           to view your prescriptions and find nearby pharmacies.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">TeleMed Platform Support Team</p>
      </div>`,
  }).catch((err) => console.error("Patient welcome email failed:", err.message));
};

// ── Password reset email (shared for all roles) ─────────────────
const sendPasswordResetEmail = async (toEmail, name, resetToken, role) => {
  const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&role=${role}`;
  await transporter.sendMail({
    from: `"TeleMed Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Request — TeleMed",
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
        <p style="color:#888;font-size:12px;">TeleMed Platform Support Team</p>
      </div>`,
  }).catch((err) => console.error("Password reset email failed:", err.message));
};

module.exports = {
  sendPharmacistWelcomeEmail,
  sendPharmacistApprovalEmail,
  sendPatientWelcomeEmail,
  sendPasswordResetEmail,
};