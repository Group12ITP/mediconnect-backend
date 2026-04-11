// services/availabilityService.js
const Availability = require('../models/Availability');

/**
 * Get all availability for a doctor within a given month.
 * Returns a map of { "YYYY-MM-DD": { slots: [...] } }
 */
const getMonthAvailability = async (doctorId, year, month) => {
  // Build date range strings: e.g., '2026-04-01' to '2026-04-30'
  const paddedMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${paddedMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

  const records = await Availability.find({
    doctor: doctorId,
    date: { $gte: startDate, $lte: endDate },
    isActive: true,
  }).lean();

  // Transform into { dateStr: { slots } } map for easy frontend consumption
  const result = {};
  for (const record of records) {
    result[record.date] = {
      slots: record.slots.filter((s) => s.isActive),
    };
  }

  return result;
};

/**
 * Save (upsert) availability for a doctor for a given month.
 * Payload format matches the frontend structure:
 * availability: { "YYYY-MM-DD": ["09:00", "10:00", ...], ... }
 * maxPatients:  { "YYYY-MM-DD_HH:MM": 5, ... }
 */
const saveMonthAvailability = async (doctorId, year, month, availability, maxPatients) => {
  const paddedMonth = String(month).padStart(2, '0');

  const operations = Object.entries(availability).map(([dateStr, times]) => {
    // Validate the date belongs to the given month
    if (!dateStr.startsWith(`${year}-${paddedMonth}`)) return null;

    const slots = times.map((time) => {
      const slotKey = `${dateStr}_${time}`;
      return {
        time,
        maxPatients: maxPatients[slotKey] || 5,
        isActive: true,
      };
    });

    return {
      updateOne: {
        filter: { doctor: doctorId, date: dateStr },
        update: { $set: { slots, isActive: true } },
        upsert: true,
      },
    };
  }).filter(Boolean);

  if (operations.length === 0) return { modifiedCount: 0, upsertedCount: 0 };

  const result = await Availability.bulkWrite(operations);
  return result;
};

/**
 * Clear all availability for a doctor in a given month.
 */
const clearMonthAvailability = async (doctorId, year, month) => {
  const paddedMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${paddedMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

  const result = await Availability.updateMany(
    { doctor: doctorId, date: { $gte: startDate, $lte: endDate } },
    { $set: { slots: [], isActive: false } }
  );

  return result;
};

/**
 * Get availability for a specific date (used to validate slot booking).
 */
const getDateAvailability = async (doctorId, date) => {
  const record = await Availability.findOne({
    doctor: doctorId,
    date,
    isActive: true,
  }).lean();

  return record || null;
};

/**
 * Copy availability from a previous month to the current month.
 * Shifts each date by roughly the same weekday pattern.
 */
const copyPreviousMonthAvailability = async (doctorId, year, month) => {
  // Determine previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevPadded = String(prevMonth).padStart(2, '0');

  const prevStartDate = `${prevYear}-${prevPadded}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevEndDate = `${prevYear}-${prevPadded}-${String(prevLastDay).padStart(2, '0')}`;

  const prevRecords = await Availability.find({
    doctor: doctorId,
    date: { $gte: prevStartDate, $lte: prevEndDate },
    isActive: true,
  }).lean();

  if (prevRecords.length === 0) return { copiedCount: 0 };

  const currentLastDay = new Date(year, month, 0).getDate();
  const paddedMonth = String(month).padStart(2, '0');

  const operations = [];

  for (const record of prevRecords) {
    const prevDay = parseInt(record.date.split('-')[2], 10);
    // Map the same day-of-month to current month (capped at last day)
    const currentDay = Math.min(prevDay, currentLastDay);
    const currentDate = `${year}-${paddedMonth}-${String(currentDay).padStart(2, '0')}`;

    operations.push({
      updateOne: {
        filter: { doctor: doctorId, date: currentDate },
        update: {
          $setOnInsert: { slots: record.slots, isActive: true }, // don't overwrite if already exists
        },
        upsert: true,
      },
    });
  }

  const result = await Availability.bulkWrite(operations);
  return { copiedCount: result.upsertedCount + result.modifiedCount };
};

module.exports = {
  getMonthAvailability,
  saveMonthAvailability,
  clearMonthAvailability,
  getDateAvailability,
  copyPreviousMonthAvailability,
};
