/**
 * Standard API Response Helpers
 * Ensures every response shape is consistent:
 * { ok, message, data?, locale }
 *
 * Controllers should pass translation keys, not raw strings.
 * Example: success(res, "appointment.created", appointment, 201)
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {string} key    - i18n translation key (dot-notation)
 * @param {*}      data   - payload to include (optional)
 * @param {number} code   - HTTP status code (default 200)
 */
exports.success = (res, key, data = null, code = 200) => {
    const payload = {
        ok: true,
        message: res.__(key),
        locale: res.getLocale ? res.getLocale() : "en"
    };
    if (data !== null && data !== undefined) {
        payload.data = data;
    }
    return res.status(code).json(payload);
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} key    - i18n translation key (dot-notation)
 * @param {number} code   - HTTP status code (default 400)
 * @param {*}      extra  - optional extra fields merged into response
 */
exports.error = (res, key, code = 400, extra = {}) => {
    const payload = {
        ok: false,
        message: res.__(key),
        locale: res.getLocale ? res.getLocale() : "en",
        ...extra
    };
    return res.status(code).json(payload);
};
