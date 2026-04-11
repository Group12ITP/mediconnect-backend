// controllers/reportController.js
const fs = require('fs');
const mongoose = require('mongoose');
const { saveReport, getPatientReports, getReportById, deleteReport } = require('../services/reportService');
const Report = require('../models/Report');
const PatientAppointment = require('../models/PatientAppointment');

async function doctorCanAccessPatientReports(doctorId, patientId) {
  return PatientAppointment.exists({
    doctor: doctorId,
    patient: patientId,
    status: { $nin: ['cancelled', 'rejected'] },
  });
}

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { category, description } = req.body;
    const report = await saveReport({ patientId: req.patient.id, file: req.file, category, description });
    res.status(201).json({ success: true, data: report });
  } catch (e) {
    console.error('uploadReport error:', e);
    res.status(500).json({ success: false, message: e.message || 'Upload failed' });
  }
};

exports.getMyReports = async (req, res) => {
  try {
    const reports = await getPatientReports(req.patient.id);
    res.json({ success: true, data: reports });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching reports' });
  }
};

exports.getPatientReportsForDoctor = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }
    const allowed = await doctorCanAccessPatientReports(req.doctor.id, patientId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'No access to this patient\'s reports' });
    }
    const reports = await Report.find({ patient: patientId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: reports });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error fetching reports' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    await deleteReport(req.patient.id, req.params.id);
    res.json({ success: true, message: 'Report deleted' });
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Report not found' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Error deleting report' });
  }
};

exports.downloadReport = async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const isOwner = String(report.patient) === req.patient?.id;
    if (isOwner) {
      // proceed
    } else if (req.doctor) {
      const allowed = await doctorCanAccessPatientReports(req.doctor.id, report.patient);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!fs.existsSync(report.path)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }
    res.download(report.path, report.originalName);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Error downloading report' });
  }
};
