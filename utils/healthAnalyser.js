/**
 * MediConnect — Health Analyser Engine
 *
 * Clinical reference standards used:
 *   Blood Glucose : ADA (American Diabetes Association) 2023 Standards of Care
 *   Cholesterol   : AHA (American Heart Association) / NCEP ATP III guidelines
 *   Blood Pressure: AHA / ACC 2017 Hypertension Guidelines
 *
 * Classification levels returned:
 *   CRITICAL_LOW  — dangerously low (hypoglycaemia / hypotension) → immediate medical care
 *   LOW           — below normal range
 *   LOW_WARNING   — borderline low, monitor
 *   NORMAL        — healthy/optimal range
 *   HIGH_WARNING  — borderline high (elevated / pre-hypertension / borderline)
 *   HIGH          — above normal, medical attention advised
 *   CRITICAL_HIGH — dangerously high (hypertensive crisis / severe hyperglycaemia) → immediate
 */

// ─── Thresholds (all in standard units) ──────────────────────────────────────

const SUGAR_THRESHOLDS = {
    // Fasting blood glucose (mg/dL)
    CRITICAL_LOW: 54,   // < 54  → severe hypoglycaemia (ADA)
    LOW: 70,   // < 70  → hypoglycaemia
    LOW_WARNING: 80,   // < 80  → mild hypoglycaemia risk
    NORMAL_MAX: 100,   // ≤ 100 → normal fasting
    HIGH_WARNING: 125,   // ≤ 125 → pre-diabetes (IFG)
    HIGH: 180,   // ≤ 180 → diabetes range
    // > 180           → CRITICAL_HIGH (severe hyperglycaemia)
};

const CHOLESTEROL_THRESHOLDS = {
    // Total cholesterol (mg/dL) — AHA/NCEP ATP III
    CRITICAL_LOW: 100,  // < 100 → dangerously low
    LOW: 120,  // < 120 → below normal
    LOW_WARNING: 150,  // < 150 → optimal but borderline
    NORMAL_MAX: 200,   // ≤ 200 → desirable
    HIGH_WARNING: 239,   // ≤ 239 → borderline high
    HIGH: 300,   // ≤ 300 → high
    // > 300           → CRITICAL_HIGH
};

const BP_THRESHOLDS = {
    systolic: {
        CRITICAL_LOW: 70,   // < 70  → severe hypotension
        LOW: 90,   // < 90  → hypotension
        LOW_WARNING: 100,  // < 100 → low-normal
        NORMAL_MAX: 120,   // ≤ 120 → normal
        HIGH_WARNING: 129,   // ≤ 129 → elevated (AHA 2017)
        HIGH: 179,   // ≤ 179 → Stage 1 (130-139) / Stage 2 (140-179)
        // > 179           → CRITICAL_HIGH (hypertensive crisis)
    },
    diastolic: {
        CRITICAL_LOW: 40,   // < 40  → critical hypotension
        LOW: 60,   // < 60  → hypotension
        LOW_WARNING: 65,   // < 65  → borderline low
        NORMAL_MAX: 80,   // ≤ 80  → normal
        HIGH_WARNING: 89,   // ≤ 89  → Stage 1
        HIGH: 119,   // ≤ 119 → Stage 2
        // ≥ 120           → CRITICAL_HIGH (hypertensive crisis)
    }
};

// ─── Helper: classify a single numeric value against a threshold set ─────────

function classifyValue(value, t) {
    if (value < t.CRITICAL_LOW) return 'CRITICAL_LOW';
    if (value < t.LOW) return 'LOW';
    if (value < t.LOW_WARNING) return 'LOW_WARNING';
    if (value <= t.NORMAL_MAX) return 'NORMAL';
    if (value <= t.HIGH_WARNING) return 'HIGH_WARNING';
    if (value <= t.HIGH) return 'HIGH';
    return 'CRITICAL_HIGH';
}

// ─── Worst classification of two ─────────────────────────────────────────────
const LEVEL_ORDER = [
    'NORMAL', 'LOW_WARNING', 'HIGH_WARNING', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH'
];

function worstOf(a, b) {
    return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

// ─── Alert priority mapping ───────────────────────────────────────────────────

function alertPriority(level) {
    switch (level) {
        case 'CRITICAL_LOW':
        case 'CRITICAL_HIGH': return 'IMMEDIATE';
        case 'LOW':
        case 'HIGH': return 'URGENT';
        case 'LOW_WARNING':
        case 'HIGH_WARNING': return 'ROUTINE';
        default: return 'NONE';
    }
}

// ─── Label & message catalogs ─────────────────────────────────────────────────

const SUGAR_LABELS = {
    CRITICAL_LOW: { label: 'Severe Hypoglycaemia', message: 'Blood sugar is dangerously low (< 54 mg/dL). This is a medical emergency — immediate sugar intake and medical attention are required.', advice: '⚠️ Consume fast-acting carbohydrates immediately (juice, glucose tablets). Call emergency services if unconscious.' },
    LOW: { label: 'Hypoglycaemia', message: 'Blood sugar is below the normal fasting range (70–100 mg/dL). Symptoms may include shakiness, dizziness, and sweating.', advice: 'Eat a small carbohydrate-rich snack. Monitor closely and report to your doctor if it persists.' },
    LOW_WARNING: { label: 'Low-Normal Blood Sugar', message: 'Blood sugar is slightly below the ideal fasting range. This may be due to delayed meals, exercise, or medication.', advice: 'Ensure regular meal timing. Discuss with your doctor if readings are consistently in this range.' },
    NORMAL: { label: 'Normal Blood Sugar', message: 'Fasting blood glucose is within the healthy range (70–100 mg/dL). Your glucose metabolism appears normal.', advice: '✅ Maintain a balanced diet, regular exercise, and healthy weight. Re-check annually.' },
    HIGH_WARNING: { label: 'Pre-Diabetes (IFG)', message: 'Fasting blood glucose is in the pre-diabetes range (100–125 mg/dL). This increases your risk of developing Type 2 diabetes.', advice: 'Reduce refined carbohydrate intake, increase physical activity, lose excess weight. Follow-up with your doctor in 3 months.' },
    HIGH: { label: 'Diabetes Range', message: 'Blood sugar levels indicate possible diabetes (126–180 mg/dL fasting). This requires medical evaluation and management.', advice: '⚠️ Consult your doctor promptly. Avoid sugary foods and carbohydrates. Regular monitoring is essential.' },
    CRITICAL_HIGH: { label: 'Severe Hyperglycaemia', message: 'Blood sugar is critically high (> 180 mg/dL fasting). Without treatment, this can lead to diabetic ketoacidosis or hyperosmolar syndrome.', advice: '🚨 Seek immediate medical attention. Do not eat or drink sugary items. Insulin therapy may be required.' }
};

const CHOLESTEROL_LABELS = {
    CRITICAL_LOW: { label: 'Critically Low Cholesterol', message: 'Total cholesterol is dangerously low (< 100 mg/dL). Very low cholesterol has been linked to increased risk of haemorrhagic stroke and mood disorders.', advice: '⚠️ Consult your doctor immediately for evaluation of underlying causes.' },
    LOW: { label: 'Below Normal Cholesterol', message: 'Total cholesterol is below the typical range (< 120 mg/dL). This may indicate nutritional deficiency or liver issues.', advice: 'Discuss dietary improvements and possible underlying conditions with your doctor.' },
    LOW_WARNING: { label: 'Optimal-Low Cholesterol', message: 'Cholesterol is on the lower end of normal (120–150 mg/dL). Generally favourable for heart health.', advice: '✅ Generally positive. Maintain a balanced diet with healthy fats. Annual check recommended.' },
    NORMAL: { label: 'Desirable Cholesterol', message: 'Total cholesterol is within the desirable range (< 200 mg/dL). Your cardiovascular risk from cholesterol is low.', advice: '✅ Great result! Continue heart-healthy lifestyle habits. Re-check every 4–6 years.' },
    HIGH_WARNING: { label: 'Borderline High Cholesterol', message: 'Total cholesterol is borderline high (200–239 mg/dL). This level is associated with an increased cardiovascular risk, especially with other risk factors.', advice: 'Reduce saturated and trans fats, increase fibre and physical activity. Re-check within 6 months.' },
    HIGH: { label: 'High Cholesterol', message: 'Total cholesterol is high (240–300 mg/dL). This significantly increases the risk of heart disease and stroke.', advice: '⚠️ Consult your doctor. Lifestyle changes and possible statin therapy may be recommended.' },
    CRITICAL_HIGH: { label: 'Very High Cholesterol', message: 'Total cholesterol is very high (> 300 mg/dL). This is associated with severe cardiovascular risk and possibly familial hypercholesterolaemia.', advice: '🚨 Urgent medical evaluation required. Do not delay — lipid-lowering therapy is likely necessary.' }
};

function bpLabel(level, systolic, diastolic) {
    const catalog = {
        CRITICAL_LOW: { label: 'Severe Hypotension', message: `Blood pressure is critically low (${systolic}/${diastolic} mmHg). This can cause organ failure if untreated.`, advice: '🚨 Seek immediate emergency care.' },
        LOW: { label: 'Hypotension', message: `Blood pressure is below normal (${systolic}/${diastolic} mmHg). Symptoms may include dizziness and fainting.`, advice: '⚠️ Increase fluid and salt intake modestly. Consult your doctor to rule out underlying causes.' },
        LOW_WARNING: { label: 'Low-Normal Blood Pressure', message: `Blood pressure is slightly low (${systolic}/${diastolic} mmHg) but generally acceptable in healthy individuals.`, advice: 'Stay hydrated. Monitor for symptoms like dizziness. Discuss with your doctor if symptomatic.' },
        NORMAL: { label: 'Normal Blood Pressure', message: `Blood pressure is optimal (${systolic}/${diastolic} mmHg). This is associated with the lowest cardiovascular risk.`, advice: '✅ Excellent! Maintain a low-sodium diet, stay active, and avoid smoking. Re-check annually.' },
        HIGH_WARNING: { label: 'Elevated Blood Pressure', message: `Blood pressure is elevated (${systolic}/${diastolic} mmHg). While not yet hypertension, lifestyle modification is recommended.`, advice: 'Reduce salt and alcohol, increase physical activity, manage stress. Re-check within 3 months.' },
        HIGH: { label: 'Hypertension (Stage 1/2)', message: `Blood pressure is high (${systolic}/${diastolic} mmHg), indicating Stage 1 or Stage 2 hypertension.`, advice: '⚠️ Medical evaluation required. Lifestyle modification and possibly antihypertensive medication needed.' },
        CRITICAL_HIGH: { label: 'Hypertensive Crisis', message: `Blood pressure is at a crisis level (${systolic}/${diastolic} mmHg — systolic > 180 or diastolic ≥ 120). This is a medical emergency.`, advice: '🚨 Seek emergency medical care immediately. Do not wait.' }
    };
    return catalog[level];
}

// ─── Main Analysis Functions ──────────────────────────────────────────────────

/**
 * Analyse fasting blood glucose.
 * @param {number} sugar - value in mg/dL
 */
function analyseSugar(sugar) {
    const level = classifyValue(sugar, SUGAR_THRESHOLDS);
    const { label, message, advice } = SUGAR_LABELS[level];

    return {
        level,
        label,
        message,
        advice,
        requiresDoctor: ['CRITICAL_LOW', 'CRITICAL_HIGH', 'LOW', 'HIGH'].includes(level),
        alertPriority: alertPriority(level),
        parameters: [{
            name: 'Fasting Blood Glucose',
            value: sugar,
            unit: 'mg/dL',
            status: level,
            normalRange: '70 – 100 mg/dL'
        }]
    };
}

/**
 * Analyse total cholesterol.
 * @param {number} cholesterol - value in mg/dL
 */
function analyseCholesterol(cholesterol) {
    const level = classifyValue(cholesterol, CHOLESTEROL_THRESHOLDS);
    const { label, message, advice } = CHOLESTEROL_LABELS[level];

    return {
        level,
        label,
        message,
        advice,
        requiresDoctor: ['CRITICAL_LOW', 'CRITICAL_HIGH', 'LOW', 'HIGH'].includes(level),
        alertPriority: alertPriority(level),
        parameters: [{
            name: 'Total Cholesterol',
            value: cholesterol,
            unit: 'mg/dL',
            status: level,
            normalRange: '< 200 mg/dL (desirable)'
        }]
    };
}

/**
 * Analyse blood pressure.
 * @param {number} systolic  - mmHg
 * @param {number} diastolic - mmHg
 */
function analyseBloodPressure(systolic, diastolic) {
    const sLevel = classifyValue(systolic, BP_THRESHOLDS.systolic);
    const dLevel = classifyValue(diastolic, BP_THRESHOLDS.diastolic);

    // Use the worst reading to drive overall classification
    const level = worstOf(sLevel, dLevel);
    const { label, message, advice } = bpLabel(level, systolic, diastolic);

    return {
        level,
        label,
        message,
        advice,
        requiresDoctor: ['CRITICAL_LOW', 'CRITICAL_HIGH', 'LOW', 'HIGH'].includes(level),
        alertPriority: alertPriority(level),
        parameters: [
            {
                name: 'Systolic Pressure',
                value: systolic,
                unit: 'mmHg',
                status: sLevel,
                normalRange: '< 120 mmHg (normal)'
            },
            {
                name: 'Diastolic Pressure',
                value: diastolic,
                unit: 'mmHg',
                status: dLevel,
                normalRange: '< 80 mmHg (normal)'
            }
        ]
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a report data object and return a full structured analysis.
 * @param {string} type   - 'SUGAR' | 'CHOLESTEROL' | 'BLOOD_PRESSURE'
 * @param {object} value  - { sugar?, cholesterol?, bp?: { systolic, diastolic } }
 * @returns {object}      analysis block
 */
exports.analyse = function (type, value) {
    switch (type) {
        case 'SUGAR':
            if (value.sugar == null) throw new Error('Missing value: sugar (mg/dL)');
            return analyseSugar(value.sugar);

        case 'CHOLESTEROL':
            if (value.cholesterol == null) throw new Error('Missing value: cholesterol (mg/dL)');
            return analyseCholesterol(value.cholesterol);

        case 'BLOOD_PRESSURE':
            if (!value.bp || value.bp.systolic == null || value.bp.diastolic == null) {
                throw new Error('Missing values: bp.systolic and bp.diastolic (mmHg)');
            }
            return analyseBloodPressure(value.bp.systolic, value.bp.diastolic);

        default:
            throw new Error(`Unknown report type: ${type}`);
    }
};

/**
 * Return the standard healthy reference ranges as a structured object.
 * Useful for UI display and education.
 */
exports.referenceRanges = {
    SUGAR: {
        unit: 'mg/dL (fasting)',
        ranges: [
            { level: 'CRITICAL_LOW', range: '< 54', label: 'Severe Hypoglycaemia', action: 'IMMEDIATE' },
            { level: 'LOW', range: '54 – 69', label: 'Hypoglycaemia', action: 'URGENT' },
            { level: 'LOW_WARNING', range: '70 – 79', label: 'Low-Normal', action: 'ROUTINE' },
            { level: 'NORMAL', range: '80 – 100', label: 'Normal', action: 'NONE' },
            { level: 'HIGH_WARNING', range: '101 – 125', label: 'Pre-Diabetes', action: 'ROUTINE' },
            { level: 'HIGH', range: '126 – 180', label: 'Diabetes Range', action: 'URGENT' },
            { level: 'CRITICAL_HIGH', range: '> 180', label: 'Severe Hyperglycaemia', action: 'IMMEDIATE' }
        ]
    },
    CHOLESTEROL: {
        unit: 'mg/dL (total)',
        ranges: [
            { level: 'CRITICAL_LOW', range: '< 100', label: 'Critically Low', action: 'IMMEDIATE' },
            { level: 'LOW', range: '100 – 119', label: 'Below Normal', action: 'URGENT' },
            { level: 'LOW_WARNING', range: '120 – 149', label: 'Optimal-Low', action: 'NONE' },
            { level: 'NORMAL', range: '150 – 200', label: 'Desirable', action: 'NONE' },
            { level: 'HIGH_WARNING', range: '201 – 239', label: 'Borderline High', action: 'ROUTINE' },
            { level: 'HIGH', range: '240 – 300', label: 'High', action: 'URGENT' },
            { level: 'CRITICAL_HIGH', range: '> 300', label: 'Very High', action: 'IMMEDIATE' }
        ]
    },
    BLOOD_PRESSURE: {
        unit: 'mmHg (systolic/diastolic)',
        ranges: [
            { level: 'CRITICAL_LOW', range: '< 70/40', label: 'Severe Hypotension', action: 'IMMEDIATE' },
            { level: 'LOW', range: '70–89 / 40–59', label: 'Hypotension', action: 'URGENT' },
            { level: 'LOW_WARNING', range: '90–99 / 60–64', label: 'Low-Normal', action: 'ROUTINE' },
            { level: 'NORMAL', range: '< 120/80', label: 'Normal / Optimal', action: 'NONE' },
            { level: 'HIGH_WARNING', range: '120–129 / < 80', label: 'Elevated', action: 'ROUTINE' },
            { level: 'HIGH', range: '130–179 / 80–119', label: 'Hypertension Stage 1/2', action: 'URGENT' },
            { level: 'CRITICAL_HIGH', range: '≥ 180 / ≥ 120', label: 'Hypertensive Crisis', action: 'IMMEDIATE' }
        ]
    }
};
