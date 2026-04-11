const axios = require("axios");

// Nominatim is OpenStreetMap's free geocoding service
// No API key needed — just respect the usage policy:
// - Max 1 request/second
// - Must send a descriptive User-Agent header
// - Do NOT use for bulk geocoding

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// ── Helper: Delay to respect 1 req/sec rate limit ──────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Convert a full address string to { lat, lng, displayName }
 * Uses Nominatim (OpenStreetMap) — completely free, no API key
 *
 * @param {string} address - e.g. "45 Galle Road, Colombo, Sri Lanka"
 * @returns {Promise<{lat, lng, displayName}>}
 */
const geocodeAddress = async (address) => {
  // Small delay to respect Nominatim's 1 req/sec policy
  await delay(1100);

  const response = await axios.get(`${NOMINATIM_BASE}/search`, {
    params: {
      q:              address,
      format:         "json",
      addressdetails: 1,
      limit:          1,
    },
    headers: {
      // Required by Nominatim usage policy — identify your app
      "User-Agent": "TeleMed-Platform/1.0 (telemedicine app, contact@telemed.lk)",
      "Accept-Language": "en",
    },
  });

  const results = response.data;

  if (!results || results.length === 0) {
    throw new Error(
      `Geocoding failed: No results found for address "${address}". ` +
      `Try a more specific address.`
    );
  }

  const result = results[0];

  return {
    lat:         parseFloat(result.lat),
    lng:         parseFloat(result.lon),
    displayName: result.display_name || address,
  };
};

/**
 * Reverse geocode: lat/lng → human-readable address
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{displayName, city, country}>}
 */
const reverseGeocode = async (lat, lng) => {
  await delay(1100);

  const response = await axios.get(`${NOMINATIM_BASE}/reverse`, {
    params: {
      lat,
      lon:    lng,
      format: "json",
    },
    headers: {
      "User-Agent": "TeleMed-Platform/1.0 (telemedicine app, contact@telemed.lk)",
      "Accept-Language": "en",
    },
  });

  const result = response.data;

  return {
    displayName: result.display_name || "",
    city:        result.address?.city || result.address?.town || result.address?.village || "",
    country:     result.address?.country || "",
  };
};

/**
 * Build a full address string from address object fields
 * @param {Object} address - { street, city, district, country }
 * @returns {string}
 */
const buildAddressString = (address) => {
  const parts = [
    address.street,
    address.city,
    address.district,
    address.province,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
};

/**
 * Build an OpenStreetMap directions URL (Leaflet-compatible)
 * Patient taps this to navigate to the pharmacy
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} name - pharmacy name for the marker label
 * @returns {string}
 */
const buildDirectionsUrl = (lat, lng, name = "") => {
  const encodedName = encodeURIComponent(name);
  // Opens OpenStreetMap with a marker at the pharmacy location
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
};

/**
 * Build a Leaflet-ready location object for frontend map rendering
 * @param {number} lat
 * @param {number} lng
 * @param {string} name
 * @param {string} address
 * @returns {Object}
 */
const buildLeafletMarker = (lat, lng, name, address) => ({
  position:  [lat, lng],
  popup:     `<strong>${name}</strong><br/>${address}`,
  directionsUrl: buildDirectionsUrl(lat, lng, name),
});

/**
 * Calculate straight-line distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 *
 * @param {number} lat1 - origin latitude
 * @param {number} lng1 - origin longitude
 * @param {number} lat2 - destination latitude
 * @param {number} lng2 - destination longitude
 * @returns {number} distance in km (rounded to 2 decimal places)
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R    = 6371;  // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

module.exports = {
  geocodeAddress,
  reverseGeocode,
  buildAddressString,
  buildDirectionsUrl,
  buildLeafletMarker,
  haversineDistance,
};