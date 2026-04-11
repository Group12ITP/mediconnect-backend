// routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getMonthAvailability,
  saveMonthAvailability,
  clearMonthAvailability,
  copyPreviousMonth,
} = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');

// All availability routes are protected
router.use(protect);

// Validation for saving availability
const saveAvailabilityValidation = [
  body('year')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be a valid integer between 2020 and 2100'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('availability')
    .isObject()
    .withMessage('availability must be an object of date -> time slots'),
];

const copyValidation = [
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Year is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
];

/**
 * GET    /api/availability          - Get monthly availability
 * POST   /api/availability          - Save/upsert monthly availability
 * DELETE /api/availability          - Clear monthly availability
 * POST   /api/availability/copy-previous - Copy from previous month
 */
router.get('/', getMonthAvailability);
router.post('/', saveAvailabilityValidation, saveMonthAvailability);
router.delete('/', clearMonthAvailability);
router.post('/copy-previous', copyValidation, copyPreviousMonth);

module.exports = router;
