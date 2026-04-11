const axios = require("axios");

// OpenFDA REST API — free, no API key needed for basic usage
// Rate limit: 240 requests/minute without key, 120000/day with key
// Docs: https://open.fda.gov/apis/
const OPENFDA_BASE = "https://api.fda.gov/drug";

const fdaGet = async (endpoint, params = {}) => {
  const response = await axios.get(`${OPENFDA_BASE}${endpoint}`, {
    params,
    timeout: 10000,
    headers: { Accept: "application/json" },
  });
  return response.data;
};

// ─────────────────────────────────────────────────────────────
// Check if a brand/drug has active recalls
// Returns { hasRecall, recallCount, recentRecalls[] }
// ─────────────────────────────────────────────────────────────
const checkRecalls = async (brandName) => {
  try {
    const data = await fdaGet("/enforcement.json", {
      search: `brand_name:"${brandName}"`,
      limit:  5,
    });

    const results = data?.results || [];
    const activeRecalls = results.filter(
      (r) => r.status === "Ongoing" || r.status === "Completed"
    );

    return {
      hasRecall:    activeRecalls.length > 0,
      recallCount:  activeRecalls.length,
      recentRecalls: activeRecalls.slice(0, 3).map((r) => ({
        recallNumber:    r.recall_number,
        reason:          r.reason_for_recall,
        classification:  r.classification, // Class I = most serious, Class III = least serious
        status:          r.status,
        recallInitiationDate: r.recall_initiation_date,
      })),
    };
  } catch (error) {
    // 404 means no recalls found — that is good
    if (error.response?.status === 404) {
      return { hasRecall: false, recallCount: 0, recentRecalls: [] };
    }
    // Other errors — return unknown rather than crashing
    return { hasRecall: null, recallCount: null, recentRecalls: [], error: "Recall check unavailable" };
  }
};

// ─────────────────────────────────────────────────────────────
// Get adverse event count for a drug (reported to FDA)
// Fewer adverse events reported = better quality signal
// ─────────────────────────────────────────────────────────────
const getAdverseEventCount = async (genericName) => {
  try {
    const data = await fdaGet("/event.json", {
      search: `patient.drug.openfda.generic_name:"${genericName}"`,
      count:  "serious",
    });

    const results = data?.results || [];
    const totalEvents = results.reduce((sum, r) => sum + (r.count || 0), 0);

    return {
      totalAdverseEvents: totalEvents,
      seriousEvents:      results.find((r) => r.term === "1")?.count || 0,
    };
  } catch {
    return { totalAdverseEvents: null, seriousEvents: null };
  }
};

// ─────────────────────────────────────────────────────────────
// Get FDA drug label info — includes warnings, manufacturer
// ─────────────────────────────────────────────────────────────
const getDrugLabelInfo = async (brandName) => {
  try {
    const data = await fdaGet("/label.json", {
      search: `openfda.brand_name:"${brandName}"`,
      limit:  1,
    });

    const result = data?.results?.[0];
    if (!result) return null;

    return {
      manufacturer:      result.openfda?.manufacturer_name?.[0]       || "",
      productType:       result.openfda?.product_type?.[0]             || "",
      route:             result.openfda?.route?.[0]                    || "",
      substanceName:     result.openfda?.substance_name?.[0]           || "",
      warnings:          result.warnings?.[0]                          || "",
      indicationsAndUsage: result.indications_and_usage?.[0]           || "",
      dosageAndAdmin:    result.dosage_and_administration?.[0]         || "",
      applicationNumber: result.openfda?.application_number?.[0]       || "",
    };
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Get drug NDC (National Drug Code) product info
// Includes package sizes, marketing status
// ─────────────────────────────────────────────────────────────
const getNdcInfo = async (genericName) => {
  try {
    const data = await fdaGet("/ndc.json", {
      search: `generic_name:"${genericName}"`,
      limit:  5,
    });

    const results = data?.results || [];
    return results.map((r) => ({
      productNdc:       r.product_ndc,
      brandName:        r.brand_name,
      genericName:      r.generic_name,
      labelerName:      r.labeler_name,
      dosageFormName:   r.dosage_form,
      marketingStatus:  r.marketing_status, // "Prescription" or "OTC"
      strength:         r.active_ingredients?.[0]
        ? `${r.active_ingredients[0].name} ${r.active_ingredients[0].strength}`
        : "",
    }));
  } catch {
    return [];
  }
};

module.exports = {
  checkRecalls,
  getAdverseEventCount,
  getDrugLabelInfo,
  getNdcInfo,
};