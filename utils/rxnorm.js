const axios = require("axios");

// RxNorm REST API — free, no API key required
// Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

// ── Helper: safe axios GET with timeout and error handling ─────
const rxGet = async (url, params = {}) => {
  try {
    const response = await axios.get(url, {
      params,
      timeout: 8000,
      headers: { Accept: "application/json" },
    });
    return response.data;
  } catch (error) {
    // Log the error details for debugging
    console.error(`RxNorm API Error: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${error.response.data}`);
    }
    // Re-throw to be handled by the calling function
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────
// SEARCH: Find medicines by name
// Returns array of { rxcui, name, synonym, tty }
// ─────────────────────────────────────────────────────────────
const searchMedicineByName = async (name) => {
  try {
    const data = await rxGet(`${RXNORM_BASE}/drugs.json`, { name });

    const conceptGroup = data?.drugGroup?.conceptGroup || [];
    const results = [];

    for (const group of conceptGroup) {
      if (group.conceptProperties) {
        for (const concept of group.conceptProperties) {
          results.push({
            rxcui: concept.rxcui,
            name: concept.name,
            tty: concept.tty,
            synonym: concept.synonym || "",
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`Error searching for medicine "${name}":`, error.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// RESOLVE RXCUI: Get the base RXCUI for an ingredient name
// e.g. "Paracetamol" or "Acetaminophen" → "161"
// ─────────────────────────────────────────────────────────────
const resolveRxcui = async (name) => {
  try {
    const data = await rxGet(`${RXNORM_BASE}/rxcui.json`, {
      name,
      search: 1,
    });

    return data?.idGroup?.rxnormId?.[0] || null;
  } catch (error) {
    console.error(`Error resolving RXCUI for "${name}":`, error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// LOOKUP: Get full medicine details by RXCUI
// Returns comprehensive information about a medicine
// ─────────────────────────────────────────────────────────────
const getMedicineByRxcui = async (rxcui) => {
  try {
    const data = await rxGet(`${RXNORM_BASE}/rxcui/${rxcui}/allProperties.json`, {
      prop: "all",
    });

    const props = data?.propConceptGroup?.propConcept || [];
    const details = {};

    for (const prop of props) {
      details[prop.propName] = prop.propValue;
    }

    return {
      rxcui,
      name: details["RxNorm Name"] || details["RXNORM"] || "",
      dosageForm: details["DOSE_FORM"] || "",
      strength: details["STRENGTH"] || "",
      fullName: details["RxNorm Name"] || "",
      tty: details["TTY"] || "",
      labeler: details["LABELER_NAME"] || details["LABELER"] || "",
    };
  } catch (error) {
    console.error(`Error getting medicine for RXCUI ${rxcui}:`, error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// BRANDS: Get all brand names for a generic medicine (by RXCUI)
// Using the correct API endpoint and parameters
// ─────────────────────────────────────────────────────────────
const getBrandsForRxcui = async (rxcui) => {
  try {
    // Try the /brands.json endpoint first (more reliable for brands)
    const brandsData = await rxGet(`${RXNORM_BASE}/brands.json`, { 
      rxcui: rxcui 
    });
    
    const brands = [];
    
    // Parse from brands.json response
    if (brandsData?.brandGroup?.conceptProperties) {
      for (const concept of brandsData.brandGroup.conceptProperties) {
        brands.push({
          rxcui: concept.rxcui,
          name: concept.name,
          tty: concept.tty || "BN",
        });
      }
    }
    
    // If no brands found, try alternate endpoint
    if (brands.length === 0) {
      // Try /related.json with proper tty parameter format
      const relatedData = await rxGet(`${RXNORM_BASE}/rxcui/${rxcui}/related.json`, {
        tty: "BN",  // Just BN for brand names
      });

      const conceptGroup = relatedData?.relatedGroup?.conceptGroup || [];
      
      for (const group of conceptGroup) {
        if (group.conceptProperties) {
          for (const concept of group.conceptProperties) {
            brands.push({
              rxcui: concept.rxcui,
              name: concept.name,
              tty: concept.tty,
            });
          }
        }
      }
    }

    // Deduplicate by name
    const seen = new Set();
    const uniqueBrands = brands.filter((b) => {
      if (seen.has(b.name)) return false;
      seen.add(b.name);
      return true;
    });

    return uniqueBrands;
  } catch (error) {
    console.error(`Error fetching brands for RXCUI ${rxcui}:`, error.message);
    return []; // Return empty array instead of throwing
  }
};

// ─────────────────────────────────────────────────────────────
// INGREDIENT INFO: Get ingredient details for a specific RXCUI
// ─────────────────────────────────────────────────────────────
const getIngredientInfo = async (rxcui) => {
  try {
    const data = await rxGet(
      `${RXNORM_BASE}/rxcui/${rxcui}/allProperties.json`,
      { prop: "all" }
    );

    const props = data?.propConceptGroup?.propConcept || [];
    const details = {};
    for (const prop of props) {
      details[prop.propName] = prop.propValue;
    }

    return {
      rxcui,
      name: details["RxNorm Name"] || details["RXNORM"] || "",
      dosageForm: details["DOSE_FORM"] || "",
      strength: details["STRENGTH"] || "",
    };
  } catch (error) {
    console.error(`Error getting ingredient info for RXCUI ${rxcui}:`, error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// BRAND DETAILS: Get all related concepts for a brand RXCUI
// ─────────────────────────────────────────────────────────────
const getBrandDetails = async (brandRxcui) => {
  try {
    const data = await rxGet(
      `${RXNORM_BASE}/rxcui/${brandRxcui}/allProperties.json`,
      { prop: "all" }
    );

    const props = data?.propConceptGroup?.propConcept || [];
    const details = {};
    for (const prop of props) {
      details[prop.propName] = prop.propValue;
    }

    return {
      rxcui: brandRxcui,
      fullName: details["RxNorm Name"] || "",
      dosageForm: details["DOSE_FORM"] || "",
      strength: details["STRENGTH"] || "",
      labeler: details["LABELER_NAME"] || details["LABELER"] || "",
    };
  } catch (error) {
    console.error(`Error getting brand details for RXCUI ${brandRxcui}:`, error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// SPELLING CHECK: Suggest correct spelling for a medicine name
// ─────────────────────────────────────────────────────────────
const spellCheckMedicine = async (name) => {
  try {
    const data = await rxGet(`${RXNORM_BASE}/spellingsuggestions.json`, { name });
    return data?.suggestionGroup?.suggestionList?.suggestion || [];
  } catch (error) {
    console.error(`Error checking spelling for "${name}":`, error.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// VALIDATE: Check if a given RXCUI is valid and active
// ─────────────────────────────────────────────────────────────
const validateRxcui = async (rxcui) => {
  try {
    // First check status
    const statusData = await rxGet(`${RXNORM_BASE}/rxcui/${rxcui}/status.json`);
    const status = statusData?.rxcuiStatus?.status;
    
    return {
      isValid: status === "Active" || status === "Quantified",
      status: status || "Unknown",
      isPack: false
    };
  } catch (error) {
    // If status check fails, try properties as fallback
    if (error.response && error.response.status === 404) {
      try {
        const propData = await rxGet(`${RXNORM_BASE}/rxcui/${rxcui}/allProperties.json`, {
          prop: "all",
        });
        
        const props = propData?.propConceptGroup?.propConcept || [];
        
        if (props.length > 0) {
          const ttyProp = props.find(p => p.propName === "TTY");
          const tty = ttyProp?.propValue || "";
          const isPack = ["BPCK", "GPCK"].includes(tty);
          const nameProp = props.find(p => p.propName === "RxNorm Name");
          const name = nameProp?.propValue || "";
          
          return {
            isValid: true,
            status: isPack ? "Pack" : "Exists",
            tty: tty,
            isPack: isPack,
            name: name
          };
        }
      } catch (propError) {
        console.error(`Properties fetch failed for ${rxcui}:`, propError.message);
      }
    }
    
    console.error("validateRxcui error:", error.message);
    return { isValid: false, status: "NotFound", isPack: false };
  }
};

// ─────────────────────────────────────────────────────────────
// GET INTERACTIONS: Check for drug-drug interactions
// ─────────────────────────────────────────────────────────────
const getDrugInteractions = async (rxcuiList) => {
  try {
    const rxcuiString = Array.isArray(rxcuiList) ? rxcuiList.join('+') : rxcuiList;
    const data = await rxGet(`${RXNORM_BASE}/interaction/list.json`, {
      rxcuis: rxcuiString
    });
    
    return data?.interactionTypeGroup || [];
  } catch (error) {
    console.error("Error getting drug interactions:", error.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// FIND INGREDIENT RXCUI: Get ingredient RXCUI from brand or product
// ─────────────────────────────────────────────────────────────
const findIngredientRxcui = async (productRxcui) => {
  try {
    const data = await rxGet(`${RXNORM_BASE}/rxcui/${productRxcui}/properties.json`);
    
    // Check if this is already an ingredient
    if (data?.properties?.tty === "IN") {
      return productRxcui;
    }
    
    // Get related ingredients
    const relatedData = await rxGet(`${RXNORM_BASE}/rxcui/${productRxcui}/related.json`, {
      tty: "IN"
    });
    
    const conceptGroup = relatedData?.relatedGroup?.conceptGroup || [];
    for (const group of conceptGroup) {
      if (group.conceptProperties && group.conceptProperties.length > 0) {
        // Return the first ingredient found
        return group.conceptProperties[0].rxcui;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding ingredient for RXCUI ${productRxcui}:`, error.message);
    return null;
  }
};

module.exports = {
  searchMedicineByName,
  resolveRxcui,
  getMedicineByRxcui,
  getBrandsForRxcui,
  getIngredientInfo,
  getBrandDetails,
  spellCheckMedicine,
  validateRxcui,
  getDrugInteractions,
  findIngredientRxcui
};