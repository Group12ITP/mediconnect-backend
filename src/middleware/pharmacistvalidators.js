const { body } = require("express-validator");

const PASSWORD_RULES = body("password")
  .notEmpty().withMessage("Password is required")
  .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage("Password must contain uppercase, lowercase, and a number");

// ── Pharmacist Register ─────────────────────────────────────────
const pharmacistRegisterValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required")
    .isLength({ min: 2, max: 50 }).withMessage("First name must be 2–50 characters"),
  body("lastName").trim().notEmpty().withMessage("Last name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Last name must be 2–50 characters"),
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address").normalizeEmail(),
  PASSWORD_RULES,
  body("licenseNumber").trim().notEmpty().withMessage("License number is required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required")
    .matches(/^[+]?[\d\s\-().]{7,20}$/).withMessage("Invalid phone number"),
];

// ── Patient Register ────────────────────────────────────────────
const patientRegisterValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required")
    .isLength({ min: 2, max: 50 }).withMessage("First name must be 2–50 characters"),
  body("lastName").trim().notEmpty().withMessage("Last name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Last name must be 2–50 characters"),
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address").normalizeEmail(),
  PASSWORD_RULES,
  body("phone").optional().trim()
    .matches(/^[+]?[\d\s\-().]{7,20}$/).withMessage("Invalid phone number"),
  body("dateOfBirth").optional().isISO8601().withMessage("Invalid date of birth"),
  body("gender").optional()
    .isIn(["male", "female", "other", "prefer_not_to_say"])
    .withMessage("Invalid gender value"),
  body("bloodGroup").optional()
    .isIn(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"])
    .withMessage("Invalid blood group"),
];

// ── Login (shared) ──────────────────────────────────────────────
const loginValidation = [
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// ── Forgot Password ─────────────────────────────────────────────
const forgotPasswordValidation = [
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address").normalizeEmail(),
];

// ── Reset Password ──────────────────────────────────────────────
const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number"),
];

// ── Change Password ─────────────────────────────────────────────
const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must differ from current password");
      }
      return true;
    }),
];

// ── Update Patient Profile ──────────────────────────────────────
const updatePatientValidation = [
  body("firstName").optional().trim()
    .isLength({ min: 2, max: 50 }).withMessage("First name must be 2–50 characters"),
  body("lastName").optional().trim()
    .isLength({ min: 2, max: 50 }).withMessage("Last name must be 2–50 characters"),
  body("phone").optional().trim()
    .matches(/^[+]?[\d\s\-().]{7,20}$/).withMessage("Invalid phone number"),
  body("gender").optional()
    .isIn(["male", "female", "other", "prefer_not_to_say"])
    .withMessage("Invalid gender value"),
  body("bloodGroup").optional()
    .isIn(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"])
    .withMessage("Invalid blood group"),
  body("address.city").optional().trim()
    .isLength({ max: 100 }).withMessage("City too long"),
  body("address.district").optional().trim()
    .isLength({ max: 100 }).withMessage("District too long"),
];

module.exports = {
  pharmacistRegisterValidation,
  patientRegisterValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updatePatientValidation,
};