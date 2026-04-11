// routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const {
  getSchedule,
  getDaySchedule,
  getScheduleStats,
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');

// All schedule routes are protected
router.use(protect);

/**
 * GET /api/schedule              - Get schedule (supports ?viewMode=week|month|day&date=YYYY-MM-DD&year=&month=)
 * GET /api/schedule/stats        - Get summary statistics (?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD)
 * GET /api/schedule/day/:date    - Get schedule for a specific day (YYYY-MM-DD)
 */
router.get('/', getSchedule);
router.get('/stats', getScheduleStats);
router.get('/day/:date', getDaySchedule);

module.exports = router;
