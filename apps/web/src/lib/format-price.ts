export const formatPrice = (price: string, currency: string) =>
  new Intl.NumberFormat('en-PK', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(Number(price));
