const PatientReport = require('../models/PatientReport');
const { analyse } = require('../../utils/healthAnalyser');

class ReportService {

    /**
     * Create a patient report and auto-run clinical analysis.
     * The `analysis` block is injected before saving — no manual classification needed.
     */
    async createReport(data) {
        const { type, value } = data;

        // Auto-classify using the health analyser engine
        const analysis = analyse(type, value);

        const report = await PatientReport.create({
            ...data,
            classification: analysis.level,
            analysis,
            thresholdVersion: 'WHO-ADA-AHA-2023'
        });

        return report;
    }

    async getReports(patientId, options = {}) {
        const { latest, type } = options;
        const query = { patientId };
        if (type) query.type = type;

        if (latest === 'true') {
            const types = ['SUGAR', 'CHOLESTEROL', 'BLOOD_PRESSURE'];
            const reports = [];
            for (const t of types) {
                const r = await PatientReport.findOne({ patientId, type: t }).sort({ createdAt: -1 });
                if (r) reports.push(r);
            }
            return reports;
        }

        return PatientReport.find(query).sort({ createdAt: -1 });
    }
}

module.exports = new ReportService();
