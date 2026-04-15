const Doctor = require('../models/Doctor');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// @desc    Register doctor
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      password,
      specialization,
      licenseNumber,
      qualification,
      experience,
      hospital,
      phoneNumber
    } = req.body;

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ 
      $or: [{ email }, { licenseNumber }] 
    });
    
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: existingDoctor.email === email 
          ? 'Doctor with this email already exists' 
          : 'Doctor with this license number already exists'
      });
    }

    // Create doctor - FIXED: Make sure to await properly
    const doctor = new Doctor({
      name,
      email,
      password,
      specialization,
      licenseNumber,
      qualification,
      experience,
      hospital,
      phoneNumber,
      isVerified: false
    });

    // Save the doctor
    await doctor.save();

    // Generate token
    const token = doctor.getSignedJwtToken();

    // Remove password from output
    const doctorResponse = doctor.toObject();
    delete doctorResponse.password;

    res.status(201).json({
      success: true,
      token,
      doctor: {
        id: doctorResponse._id,
        name: doctorResponse.name,
        email: doctorResponse.email,
        specialization: doctorResponse.specialization,
        licenseNumber: doctorResponse.licenseNumber,
        hospital: doctorResponse.hospital,
        doctorCode: doctorResponse.doctorCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login doctor
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for doctor
    const doctor = await Doctor.findOne({ email }).select('+password');

    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!doctor.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }
    if (!doctor.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin verification.'
      });
    }

    // Check password
    const isPasswordMatch = await doctor.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    doctor.lastLogin = Date.now();
    await doctor.save({ validateBeforeSave: false });

    // Generate token with custom expiry if remember me
    let token;
    if (rememberMe) {
      token = jwt.sign(
        { id: doctor._id, email: doctor.email, role: 'doctor' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
    } else {
      token = doctor.getSignedJwtToken();
    }

    // Remove password from output
    doctor.password = undefined;

    res.status(200).json({
      success: true,
      token,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        lastLogin: doctor.lastLogin,
        doctorCode: doctor.doctorCode
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current logged in doctor
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctor.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.status(200).json({
      success: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        qualification: doctor.qualification,
        experience: doctor.experience,
        hospital: doctor.hospital,
        phoneNumber: doctor.phoneNumber,
        isVerified: doctor.isVerified,
        lastLogin: doctor.lastLogin,
        createdAt: doctor.createdAt,
        doctorCode: doctor.doctorCode
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Logout doctor / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const doctor = await Doctor.findById(req.doctor.id).select('+password');

    // Check current password
    const isPasswordMatch = await doctor.matchPassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    doctor.password = newPassword;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Forgot password - send reset token
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const doctor = await Doctor.findOne({ email });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'No doctor found with that email'
      });
    }

    // In production, send email with reset token
    // For now, just return a success message
    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};