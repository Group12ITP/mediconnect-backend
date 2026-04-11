const jwt = require("jsonwebtoken");

/**
 * Generate a signed JWT access token
 * @param {Object} payload - { id, role }
 * @returns {string} signed JWT
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {Object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Generate a short-lived token for password reset
 * @param {Object} payload
 * @returns {string} signed JWT (15 min expiry)
 */
const generateResetToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
};

module.exports = { generateToken, verifyToken, generateResetToken };