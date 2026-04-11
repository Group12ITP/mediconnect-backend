/**
 * Brand Quality Scoring System
 *
 * Combines signals from RxNorm and OpenFDA to produce a quality score
 * for each brand of a medicine. Higher score = better recommendation.
 *
 * Scoring components:
 *  - No active recalls:         +40 points  (most critical)
 *  - Recall classification:     -10 to -30 points if recalled
 *  - FDA label info available:  +20 points  (means it's FDA-registered)
 *  - Low adverse events:        +20 points  (fewer reports = safer signal)
 *  - Has manufacturer info:     +10 points
 *  - Has detailed brand info:   +10 points
 *
 * Max possible score: 100
 */

const scoreBrand = (brand, recallInfo, labelInfo, adverseInfo) => {
  let score = 0;
  const signals = [];

  // ── Recall check (40 points max) ───────────────────────────
  if (recallInfo.hasRecall === null) {
    // API unavailable — neutral
    score += 20;
    signals.push({ signal: "recall_check_unavailable", impact: 0 });
  } else if (!recallInfo.hasRecall) {
    score += 40;
    signals.push({ signal: "no_active_recalls", impact: +40 });
  } else {
    // Penalise based on recall classification
    const classifications = recallInfo.recentRecalls.map((r) => r.classification);
    const hasClassI  = classifications.includes("Class I");   // Most dangerous
    const hasClassII = classifications.includes("Class II");  // Moderate

    if (hasClassI) {
      score -= 30;
      signals.push({ signal: "class_i_recall", impact: -30 });
    } else if (hasClassII) {
      score -= 15;
      signals.push({ signal: "class_ii_recall", impact: -15 });
    } else {
      score -= 5;
      signals.push({ signal: "class_iii_recall", impact: -5 });
    }
  }

  // ── FDA label registration (20 points) ─────────────────────
  if (labelInfo) {
    score += 20;
    signals.push({ signal: "fda_label_registered", impact: +20 });

    // Bonus: has manufacturer info
    if (labelInfo.manufacturer) {
      score += 10;
      signals.push({ signal: "manufacturer_known", impact: +10 });
    }
  }

  // ── Adverse events (20 points) ──────────────────────────────
  if (adverseInfo.totalAdverseEvents === null) {
    // API unavailable — neutral
    score += 10;
    signals.push({ signal: "adverse_events_unavailable", impact: 0 });
  } else if (adverseInfo.totalAdverseEvents === 0) {
    score += 20;
    signals.push({ signal: "no_adverse_events_reported", impact: +20 });
  } else if (adverseInfo.totalAdverseEvents < 100) {
    score += 15;
    signals.push({ signal: "low_adverse_events", impact: +15 });
  } else if (adverseInfo.totalAdverseEvents < 1000) {
    score += 5;
    signals.push({ signal: "moderate_adverse_events", impact: +5 });
  } else {
    score += 0;
    signals.push({ signal: "high_adverse_events", impact: 0 });
  }

  // ── Brand detail richness (+10 max) ─────────────────────────
  if (brand.labeler || brand.dosageForm) {
    score += 10;
    signals.push({ signal: "detailed_brand_info", impact: +10 });
  }

  return {
    score:   Math.max(0, Math.min(100, score)), // Clamp 0–100
    signals,
  };
};

/**
 * Given an array of brands with their quality data,
 * sort by score descending and return with rank + recommendation label
 *
 * @param {Array} scoredBrands
 * @returns {Array} ranked brands
 */
const rankBrands = (scoredBrands) => {
  scoredBrands.sort((a, b) => b.qualityScore - a.qualityScore);

  return scoredBrands.map((brand, index) => {
    let recommendationLabel;
    if (index === 0) {
      recommendationLabel =
        brand.qualityScore >= 70 ? "⭐ Top Recommendation"  :
        brand.qualityScore >= 50 ? "✅ Recommended"          :
                                   "⚠️ Use with Caution";
    } else if (index === 1) {
      recommendationLabel = "✅ Good Alternative";
    } else {
      recommendationLabel = "ℹ️ Available Option";
    }

    return {
      ...brand,
      rank: index + 1,
      recommendationLabel,
    };
  });
};

module.exports = { scoreBrand, rankBrands };