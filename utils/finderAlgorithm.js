const { haversineDistance } = require("./geocoding");

/**
 * Given a list of pharmacies that each stock ALL required medicines,
 * score and rank them by a combined price + distance score.
 *
 * Scoring formula:
 *   score = (priceWeight * normalisedTotalPrice) + (distanceWeight * normalisedDistance)
 *
 * Lower score = better rank (cheaper + closer = rank 1)
 *
 * @param {Array} candidates - Each item:
 *   {
 *     pharmacy:     Pharmacy document,
 *     medicines:    [{ rxcui, genericName, pricePerUnit, quantityInStock, brandName }],
 *     totalPrice:   Number,
 *     distanceKm:   Number,
 *   }
 * @param {number} priceWeight    - 0.0 to 1.0 (default 0.6)
 * @param {number} distanceWeight - 0.0 to 1.0 (default 0.4)
 * @returns {Array} top 3 ranked candidates with score metadata
 */
const rankPharmacies = (candidates, priceWeight = 0.6, distanceWeight = 0.4) => {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ ...candidates[0], rank: 1, score: 0, scoreBreakdown: null }];
  }

  // ── Extract min/max for normalisation ──────────────────────
  const prices    = candidates.map((c) => c.totalPrice);
  const distances = candidates.map((c) => c.distanceKm);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDist  = Math.min(...distances);
  const maxDist  = Math.max(...distances);

  const priceRange = maxPrice - minPrice || 1;   // avoid /0
  const distRange  = maxDist  - minDist  || 1;

  // ── Score each candidate ────────────────────────────────────
  const scored = candidates.map((c) => {
    const normPrice = (c.totalPrice  - minPrice) / priceRange; // 0=cheapest, 1=priciest
    const normDist  = (c.distanceKm - minDist)  / distRange;   // 0=closest,  1=farthest

    const score = priceWeight * normPrice + distanceWeight * normDist;

    return {
      ...c,
      score: Math.round(score * 1000) / 1000,
      scoreBreakdown: {
        priceScore:    Math.round(normPrice * 1000) / 1000,
        distanceScore: Math.round(normDist  * 1000) / 1000,
        priceWeight,
        distanceWeight,
      },
    };
  });

  // ── Sort ascending (lower score = better) + take top 3 ─────
  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, 3).map((c, i) => ({ ...c, rank: i + 1 }));
};

/**
 * Format a single ranked pharmacy result for the API response
 * Includes everything the frontend needs to display the result
 * and the patient needs to navigate to the pharmacy.
 *
 * @param {Object} ranked - output from rankPharmacies()
 * @returns {Object} clean response object
 */
const formatPharmacyResult = (ranked) => {
  const { pharmacy, medicines, totalPrice, distanceKm, rank, score, scoreBreakdown } = ranked;

  return {
    rank,
    score,
    scoreBreakdown,

    // ── Pharmacy Details ──────────────────────────────────────
    pharmacy: {
      pharmacyId:    pharmacy.pharmacyId,
      name:          pharmacy.name,
      phone:         pharmacy.phone,
      email:         pharmacy.email,
      address:       pharmacy.address,
      distanceKm,
      distanceLabel: distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m away`
        : `${distanceKm} km away`,
      is24Hours:     pharmacy.is24Hours,
      operatingHours: pharmacy.operatingHours,
      isVerified:    pharmacy.isVerified,

      // ── Map Data (Leaflet-ready) ───────────────────────────
      latitude:     pharmacy.latitude,
      longitude:    pharmacy.longitude,
      directionsUrl: pharmacy.latitude && pharmacy.longitude
        ? `https://www.openstreetmap.org/?mlat=${pharmacy.latitude}&mlon=${pharmacy.longitude}#map=17/${pharmacy.latitude}/${pharmacy.longitude}`
        : null,
      leafletMarker: pharmacy.latitude && pharmacy.longitude
        ? {
            position: [pharmacy.latitude, pharmacy.longitude],
            popup:    `<strong>${pharmacy.name}</strong><br/>${pharmacy.address?.street}, ${pharmacy.address?.city}<br/>📞 ${pharmacy.phone}`,
          }
        : null,
    },

    // ── Medicine Availability & Pricing ───────────────────────
    medicines: medicines.map((m) => ({
      rxcui:          m.rxcui,
      genericName:    m.genericName,
      brandName:      m.brandName || "Generic",
      dosageForm:     m.dosageForm,
      strength:       m.strength,
      pricePerUnit:   m.pricePerUnit,
      currency:       m.currency,
      quantityInStock: m.quantityInStock,
      inStock:        m.quantityInStock > 0,
    })),

    // ── Pricing Summary ───────────────────────────────────────
    pricing: {
      totalPrice:   Math.round(totalPrice * 100) / 100,
      currency:     medicines[0]?.currency || "LKR",
      cheapestLabel: `Total: ${medicines[0]?.currency || "LKR"} ${(Math.round(totalPrice * 100) / 100).toFixed(2)}`,
    },
  };
};

module.exports = { rankPharmacies, formatPharmacyResult };