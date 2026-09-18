/**
 * Currency — single source of truth for deal-value formatting and
 * the currency picker options.
 *
 * Before this module, ~6 components each defined their own
 * `Intl.NumberFormat(..., { currency: "USD" })` helper with USD
 * baked in. The default currency is now configurable per account
 * (accounts.default_currency, migration 021), so every formatter
 * takes a currency and falls back to DEFAULT_CURRENCY only when
 * nothing is known.
 */

/** App-wide fallback when no account/deal currency is available. */
export const DEFAULT_CURRENCY = "USD";

export interface CurrencyOption {
  /** ISO-4217 code, e.g. "USD". Stored verbatim in the DB. */
  code: string;
  /** Human label for the dropdown, e.g. "US Dollar". */
  label: string;
  /** Symbol for compact display, e.g. "$". */
  symbol: string;
}

/**
 * The currencies offered in pickers. Codes must be valid ISO-4217 so
 * `Intl.NumberFormat` renders the right symbol/grouping. Extend this
 * list to offer more — nothing else needs to change.
 */
export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
  { code: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "MXN", label: "Mexican Peso", symbol: "$" },
  { code: "COP", label: "Colombian Peso", symbol: "$" },
  { code: "DOP", label: "Dominican Peso", symbol: "RD$" },
  { code: "ARS", label: "Argentine Peso", symbol: "$" },
];

/**
 * Currencies offered by the Payments module (products/prices) — the
 * five LatAm-focused codes this product's merchants actually price
 * in. A narrower, explicitly-ordered subset of {@link CURRENCIES}
 * (which also serves the unrelated deals/pipelines picker).
 *
 * `paypalSupported` matters because this app's only payment gateway
 * is PayPal (`src/lib/payments/paypal-client.ts`), and PayPal's
 * Orders v2 API only accepts a fixed list of settlement currencies
 * (developer.paypal.com/api/nvp-soap/currency-codes) — DOP, COP and
 * ARS are NOT on it (verified directly against that page), even
 * though PayPal recognizes DOP for account balances/withdrawals in
 * the Dominican Republic, which is a different thing. A price saved
 * in one of those three can still be recorded/displayed, but
 * publishing it would produce a checkout PayPal rejects at the
 * moment a customer tries to pay — so callers that create/publish a
 * live checkout must check this flag and block, not just warn.
 */
export const PAYMENT_CURRENCIES: (CurrencyOption & { paypalSupported: boolean })[] = [
  { code: "DOP", label: "Dominican Peso", symbol: "RD$", paypalSupported: false },
  { code: "COP", label: "Colombian Peso", symbol: "$", paypalSupported: false },
  { code: "MXN", label: "Mexican Peso", symbol: "$", paypalSupported: true },
  { code: "USD", label: "US Dollar", symbol: "$", paypalSupported: true },
  { code: "ARS", label: "Argentine Peso", symbol: "$", paypalSupported: false },
];

export const PAYMENT_CURRENCY_CODES: readonly string[] = PAYMENT_CURRENCIES.map((c) => c.code);

/** True when PayPal's Orders v2 API can actually process a checkout in this currency. */
export function isPaypalSupportedCurrency(code: string): boolean {
  return PAYMENT_CURRENCIES.find((c) => c.code === code)?.paypalSupported ?? false;
}

/**
 * Format a deal value as a currency string. Whole-number output
 * (no minor units) — deal values are tracked to the dollar across
 * the app. `currency` defaults to USD so callers with nothing better
 * stay safe, but pass the account/deal currency wherever known.
 *
 * Total by design: `Intl.NumberFormat` throws a RangeError on a
 * structurally invalid currency code, and `deals.currency` carries
 * NO DB CHECK (only `accounts.default_currency` does), so legacy
 * rows, imports, or hand-edited data can hold malformed values like
 * "United States". We never let that crash a render — on a bad code
 * we fall back to "CODE 1,234".
 */
export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const code = (currency || DEFAULT_CURRENCY).trim();
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Invalid ISO code — show the raw code + grouped number so the
    // value is still legible instead of throwing.
    return `${code} ${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(amount)}`;
  }
}

/**
 * Format a PAYMENT price (a product/form's `amount`, `NUMERIC(12,2)`
 * in Postgres — see migration 050) as a currency string, keeping
 * cents. Deliberately separate from {@link formatCurrency}: that one
 * rounds to whole units for deal values tracked across the sales
 * pipeline, but a checkout price of 49.99 must never render as "$50"
 * — losing the cents on a payment page is a real bug, not cosmetic.
 * Falls back the same way `formatCurrency` does on a malformed code.
 */
export function formatPaymentAmount(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const code = (currency || DEFAULT_CURRENCY).trim();
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

/**
 * Compact currency for tight spaces (donut center, legend rows):
 * "$1.2M" / "€34.5k" / "₹900". Uses the currency's symbol from
 * CURRENCIES, falling back to the code when we don't carry a symbol.
 */
export function formatCurrencyShort(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const code = currency || DEFAULT_CURRENCY;
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;
  return `${symbol}${formatCompactNumber(value)}`;
}

/**
 * Compact number for tight spaces (chart tiles, legends): 1_234 → "1.2k",
 * 1_200_000 → "1.2M", 900 → "900". The unit-less core shared with
 * {@link formatCurrencyShort}.
 */
export function formatCompactNumber(value: number): string {
  const v = Number(value || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}
