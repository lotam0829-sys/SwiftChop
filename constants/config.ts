// SwiftChop App Configuration
export const config = {
  appName: 'SwiftChop',
  tagline: 'Fast food delivery in Nigeria',
  currency: '₦',
  serviceFee: 200,
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
export function calculateDeliveryFee(distanceKm?: number | null): number {
  const km = distanceKm ?? deliveryPricing.defaultEstimateKm;
  const raw = deliveryPricing.baseFee + Math.ceil(km) * deliveryPricing.perKmRate;
  return Math.min(deliveryPricing.maxFee, Math.max(deliveryPricing.minFee, raw));
}
