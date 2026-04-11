// middleware/patientAuthMiddleware.js
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');

exports.protectPatient = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'This route is for patients only' });
    }

    const patient = await Patient.findById(decoded.id);
    if (!patient || !patient.isActive) {
      return res.status(401).json({ success: false, message: 'Patient account not found or deactivated' });
    }

    req.patient = { id: decoded.id, email: decoded.email, role: 'patient' };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
