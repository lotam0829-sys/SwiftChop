
// SwiftChop App Configuration
export const config = {
  appName: 'SwiftChop',
  tagline: 'Fast food delivery in Nigeria',
  currency: '₦',
  serviceFee: 200,
  vatRate: 0.075, // Nigerian VAT at 7.5%
  minOrder: 2000,
  defaultLocation: 'Lagos, Nigeria',
  estimatedDelivery: '25-40 min',
  supportEmail: 'support@swiftchop.ng',
  supportPhone: '+234 800 000 0000',
};

// Distance-based delivery fee pricing
// Delivery fee is calculated as: baseFee + (distance_km * perKmRate)
// Clamped between minFee and maxFee
export const deliveryPricing = {
  baseFee: 500,       // ₦500 base fee
  perKmRate: 150,     // ₦150 per kilometre
  minFee: 500,        // Minimum delivery fee
  maxFee: 5000,       // Maximum delivery fee cap
  defaultEstimateKm: 5, // Default distance estimate when actual distance is unknown (km)
};

/**
 * Calculate delivery fee from distance in kilometres.
 * Uses: baseFee + (km * perKmRate), clamped to [minFee, maxFee].
 */
// Cuisine → color mapping for pill tags
export const cuisineColors: Record<string, { bg: string; text: string }> = {
  nigerian: { bg: '#FFF3E0', text: '#E65100' },
  continental: { bg: '#E3F2FD', text: '#1565C0' },
  chinese: { bg: '#FCE4EC', text: '#C62828' },
  indian: { bg: '#FFF8E1', text: '#F57F17' },
  italian: { bg: '#E8F5E9', text: '#2E7D32' },
  'fast food': { bg: '#FBE9E7', text: '#BF360C' },
  seafood: { bg: '#E0F2F1', text: '#00695C' },
  'bbq & grill': { bg: '#EFEBE9', text: '#4E342E' },
  healthy: { bg: '#F1F8E9', text: '#33691E' },
  desserts: { bg: '#FCE4EC', text: '#AD1457' },
  african: { bg: '#FFF3E0', text: '#E65100' },
  american: { bg: '#E3F2FD', text: '#1565C0' },
  asian: { bg: '#FFF8E1', text: '#F57F17' },
  mediterranean: { bg: '#E8F5E9', text: '#2E7D32' },
  'middle eastern': { bg: '#FFF8E1', text: '#FF8F00' },
  default: { bg: '#F3F4F6', text: '#6B7280' },
};

export function getCuisineColor(cuisine: string): { bg: string; text: string } {
  const key = cuisine.toLowerCase().trim();
  // Try exact match first
  if (cuisineColors[key]) return cuisineColors[key];
  // Try partial match
  for (const [k, v] of Object.entries(cuisineColors)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return cuisineColors.default;
}

/**
 * Parse a cuisine string (e.g. "Nigerian, Continental") into an array of cuisine names.
 */
export function parseCuisines(cuisine: string): string[] {
  return cuisine.split(/[,\/&]+/).map(c => c.trim()).filter(Boolean).slice(0, 3);
}

export function calculateDeliveryFee(distanceKm?: number | null): number {
  const km = distanceKm ?? deliveryPricing.defaultEstimateKm;
  const raw = deliveryPricing.baseFee + Math.ceil(km) * deliveryPricing.perKmRate;
  return Math.min(deliveryPricing.maxFee, Math.max(deliveryPricing.minFee, raw));
}
