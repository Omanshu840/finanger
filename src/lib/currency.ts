/**
 * Format a number as currency using user's locale and currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Format a number as Indian Rupee without paise for compact portfolio displays.
 */
export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format investment units/quantity.
 */
export function formatUnits(value: number, decimals = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Parse a currency string to a number
 */
export function parseCurrencyString(value: string): number {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}
