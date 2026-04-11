// services/reportService.js
const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');

const saveReport = async ({ patientId, file, category, description }) => {
  const report = new Report({
    patient: patientId,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    category: category || 'Other',
    description: description || '',
  });
  await report.save();
  return report;
};

const getPatientReports = async (patientId) => {
  return Report.find({ patient: patientId }).sort({ createdAt: -1 }).lean();
};

const getReportById = async (id) => {
  return Report.findById(id).lean();
};

const deleteReport = async (patientId, reportId) => {
  const report = await Report.findOne({ _id: reportId, patient: patientId });
  if (!report) throw new Error('NOT_FOUND');
  // Delete file from disk
  if (fs.existsSync(report.path)) {
    fs.unlinkSync(report.path);
  }
  await Report.deleteOne({ _id: reportId });
  return true;
};

module.exports = { saveReport, getPatientReports, getReportById, deleteReport };
