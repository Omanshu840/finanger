function normalized(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort()
}

export const investmentPriceQueryKeys = {
  all: ['investment-prices'] as const,
  stocks: (symbols: string[]) => [...investmentPriceQueryKeys.all, 'stocks', normalized(symbols)] as const,
  mutualFunds: (isins: string[]) => [...investmentPriceQueryKeys.all, 'mutual-funds', normalized(isins)] as const,
}
