// Formatting helpers shared across commerce components.

/**
 * Format a price in the smallest currency unit (cents) as a localized
 * string. Falls back to a simple "$12.00" form if Intl is unavailable
 * or the currency is unknown.
 */
export function formatPrice(cents: number, currency = 'USD'): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toFixed(2)}`;
  }
}
