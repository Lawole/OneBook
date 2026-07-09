// ============================================
// config/fx.js
// FX conversion helper — used by reports (P&L,
// Balance Sheet, Cash Flow, etc.) to convert
// foreign-currency amounts into the OneBook
// account's base currency.
//
// Rate model: 1 unit of `currency_code` on
// `rate_date` = `rate` units of the base currency.
// ============================================

const pool = require('./database');

/**
 * Get the exchange rate to base currency for a currency on a specific date.
 * Falls back to the nearest previous rate if none is set for that exact date.
 * Returns null if no rate has ever been recorded and the code is not base.
 *
 * @param {number} companyId
 * @param {string} currencyCode  e.g. "NGN"
 * @param {string} date          ISO date "YYYY-MM-DD"
 * @returns {Promise<number|null>}
 */
async function getFxRateOnOrBefore(companyId, currencyCode, date) {
  // Base currency always converts 1:1.
  const comp = await pool.query(
    'SELECT base_currency FROM companies WHERE id = $1',
    [companyId]
  );
  const base = comp.rows[0]?.base_currency;
  if (!currencyCode || !base) return 1;
  if (String(currencyCode).toUpperCase() === String(base).toUpperCase()) return 1;

  const q = await pool.query(
    `SELECT rate FROM fx_rates
     WHERE company_id = $1
       AND currency_code = $2
       AND rate_date <= $3
     ORDER BY rate_date DESC
     LIMIT 1`,
    [companyId, currencyCode, date]
  );
  if (q.rows.length) return parseFloat(q.rows[0].rate);

  // No historical rate — try the earliest future rate as a last resort so
  // reports don't just silently drop foreign transactions.
  const future = await pool.query(
    `SELECT rate FROM fx_rates
     WHERE company_id = $1 AND currency_code = $2
     ORDER BY rate_date ASC
     LIMIT 1`,
    [companyId, currencyCode]
  );
  if (future.rows.length) return parseFloat(future.rows[0].rate);

  return null;
}

/**
 * Convert an amount in `currency_code` on `date` into the company base
 * currency using the rate helper above. If no rate exists at all, returns
 * `amount` unchanged and a `converted:false` flag so the caller can flag
 * missing rates in the report.
 *
 * @returns {Promise<{amount:number, rate:number|null, converted:boolean}>}
 */
async function convertToBase(companyId, amount, currencyCode, date) {
  const rate = await getFxRateOnOrBefore(companyId, currencyCode, date);
  if (rate === null) {
    return { amount: parseFloat(amount) || 0, rate: null, converted: false };
  }
  return {
    amount: (parseFloat(amount) || 0) * rate,
    rate,
    converted: true,
  };
}

module.exports = { getFxRateOnOrBefore, convertToBase };
