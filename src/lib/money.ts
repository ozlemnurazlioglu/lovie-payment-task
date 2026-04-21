const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

/**
 * Parse a user-entered dollar string into integer cents.
 * Accepts "50", "50.00", "50.5", "$50", "1,000.25".
 * Returns null for empty / invalid / non-positive input, so callers can
 * surface a precise validation error.
 */
export function toCents(input: string): number | null {
  const cleaned = input.replace(/[,\s$]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const paddedFrac = (frac + '00').slice(0, 2);
  const n = parseInt(whole || '0', 10) * 100 + parseInt(paddedFrac, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Cents → the canonical dollar-input string, e.g. 5000 → "50.00". */
export function centsToDollarInput(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100).toString().padStart(2, '0');
  return `${whole}.${frac}`;
}
