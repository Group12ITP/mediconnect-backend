const ReportService = require('../services/AnalyzeReportService');
const PatientReport = require('../models/PatientReport');
const { success, error } = require('../../utils/response');
const { referenceRanges } = require('../../utils/healthAnalyser');

// ─── Create Report (auto-analysed) ───────────────────────────────────────────
exports.createReport = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const reportData = { ...req.body, patientId };

        const report = await ReportService.createReport(reportData);

        // Surface the analysis prominently in the response
        return res.status(201).json({
            ok: true,
            message: res.__('report.created'),
            locale: req.locale,
            data: {
                report,
                analysis: {
                    level: report.analysis.level,
                    label: report.analysis.label,
                    alertPriority: report.analysis.alertPriority,
                    requiresDoctor: report.analysis.requiresDoctor,
                    message: report.analysis.message,
                    advice: report.analysis.advice,
                    parameters: report.analysis.parameters
                }
            }
        });
    } catch (err) {
        if (err.message && err.message.startsWith('Missing value')) {
            return error(res, 'validation.missing_fields', 400, { detail: err.message });
        }
        next(err);
    }
};

// ─── Get Reports ─────────────────────────────────────────────────────────────
exports.getReports = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const reports = await ReportService.getReports(patientId, req.query);

        res.status(200).json({
            ok: true,
            message: res.__('common.success'),
            count: reports.length,
            data: reports,
            locale: req.locale
        });
    } catch (err) {
        next(err);
    }
};

// ─── Reference Ranges ─────────────────────────────────────────────────────────
// GET /api/patients/:patientId/reports/reference
// Returns the clinical threshold reference table — useful for UI
exports.getReferenceRanges = (req, res) => {
    res.status(200).json({
        ok: true,
        message: res.__('common.success'),
        locale: req.locale,
        data: referenceRanges
    });
};
