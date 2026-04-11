// controllers/scheduleController.js
const scheduleService = require('../services/scheduleService');

/**
 * Helper to get ISO week date range (Sun–Sat) for a given date string.
 */
const getWeekRange = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0=Sun
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return { startDate: fmt(startOfWeek), endDate: fmt(endOfWeek) };
};

/**
 * Helper to get month date range for a given year/month.
 */
const getMonthRange = (year, month) => {
  const paddedMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${paddedMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

/**
 * @desc    Get full schedule (week/month/day view)
 * @route   GET /api/schedule?viewMode=week&date=2026-04-09&year=2026&month=4
 * @access  Private (Doctor)
 */
exports.getSchedule = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const viewMode = req.query.viewMode || 'week'; // 'day' | 'week' | 'month'
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    let startDate, endDate;

    if (viewMode === 'day') {
      startDate = dateStr;
      endDate = dateStr;
    } else if (viewMode === 'week') {
      ({ startDate, endDate } = getWeekRange(dateStr));
    } else {
      // month
      ({ startDate, endDate } = getMonthRange(year, month));
    }

    const scheduleData = await scheduleService.getScheduleForRange(doctorId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        viewMode,
        startDate,
        endDate,
        schedule: scheduleData,
      },
    });
  } catch (error) {
    console.error('getSchedule error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedule' });
  }
};

/**
 * @desc    Get schedule for a specific day
 * @route   GET /api/schedule/day/:date
 * @access  Private (Doctor)
 */
exports.getDaySchedule = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format' });
    }

    const dayData = await scheduleService.getDaySchedule(doctorId, date);

    res.status(200).json({
      success: true,
      data: dayData,
    });
  } catch (error) {
    console.error('getDaySchedule error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching day schedule' });
  }
};

/**
 * @desc    Get schedule statistics for a date range
 * @route   GET /api/schedule/stats?startDate=2026-04-01&endDate=2026-04-30
 * @access  Private (Doctor)
 */
exports.getScheduleStats = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ success: false, message: 'Dates must be in YYYY-MM-DD format' });
    }

    const stats = await scheduleService.getScheduleStats(doctorId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('getScheduleStats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedule stats' });
  }
};
