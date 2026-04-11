// controllers/availabilityController.js
const { validationResult } = require('express-validator');
const availabilityService = require('../services/availabilityService');

/**
 * @desc    Get doctor's availability for a specific month
 * @route   GET /api/availability?year=2026&month=4
 * @access  Private (Doctor)
 */
exports.getMonthAvailability = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    const availability = await availabilityService.getMonthAvailability(doctorId, year, month);

    // Transform to frontend format: { "YYYY-MM-DD": ["09:00", "10:00"], ... }
    const availabilityMap = {};
    const maxPatientsMap = {};

    for (const [date, data] of Object.entries(availability)) {
      availabilityMap[date] = data.slots.map((s) => s.time);
      for (const slot of data.slots) {
        maxPatientsMap[`${date}_${slot.time}`] = slot.maxPatients;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        availability: availabilityMap,
        maxPatients: maxPatientsMap,
        year,
        month,
      },
    });
  } catch (error) {
    console.error('getMonthAvailability error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching availability' });
  }
};

/**
 * @desc    Save doctor's availability for a month (creates or overwrites)
 * @route   POST /api/availability
 * @access  Private (Doctor)
 * @body    { year, month, availability: { "YYYY-MM-DD": ["09:00",...] }, maxPatients: { "YYYY-MM-DD_HH:MM": 5 } }
 */
exports.saveMonthAvailability = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const doctorId = req.doctor.id;
    const { year, month, availability, maxPatients } = req.body;

    if (!year || !month || !availability) {
      return res.status(400).json({ success: false, message: 'year, month, and availability are required' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    const result = await availabilityService.saveMonthAvailability(
      doctorId,
      parseInt(year),
      parseInt(month),
      availability,
      maxPatients || {}
    );

    const totalSlots = Object.values(availability).reduce((sum, slots) => sum + slots.length, 0);

    res.status(200).json({
      success: true,
      message: 'Availability saved successfully',
      data: {
        daysConfigured: Object.keys(availability).length,
        totalSlots,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
      },
    });
  } catch (error) {
    console.error('saveMonthAvailability error:', error);
    res.status(500).json({ success: false, message: 'Server error saving availability' });
  }
};

/**
 * @desc    Clear all availability for a given month
 * @route   DELETE /api/availability?year=2026&month=4
 * @access  Private (Doctor)
 */
exports.clearMonthAvailability = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    await availabilityService.clearMonthAvailability(doctorId, year, month);

    res.status(200).json({
      success: true,
      message: `Availability cleared for ${year}-${String(month).padStart(2, '0')}`,
    });
  } catch (error) {
    console.error('clearMonthAvailability error:', error);
    res.status(500).json({ success: false, message: 'Server error clearing availability' });
  }
};

/**
 * @desc    Copy availability from previous month to current month
 * @route   POST /api/availability/copy-previous
 * @access  Private (Doctor)
 * @body    { year, month }
 */
exports.copyPreviousMonth = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    const result = await availabilityService.copyPreviousMonthAvailability(
      doctorId,
      parseInt(year),
      parseInt(month)
    );

    res.status(200).json({
      success: true,
      message: result.copiedCount > 0
        ? `Copied ${result.copiedCount} day(s) from previous month`
        : 'No availability found in the previous month to copy',
      data: result,
    });
  } catch (error) {
    console.error('copyPreviousMonth error:', error);
    res.status(500).json({ success: false, message: 'Server error copying availability' });
  }
};
