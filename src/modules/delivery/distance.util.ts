import { AppError }  from '../../core/AppError';
import { PRICING }   from '../../core/constants';

/**
 * KAAGAZSEVA - Delivery Distance Utility
 * Haversine-based geo calculation
 * Uses PRICING constants as single source of truth
 */

export interface DistanceResult {
  distanceKm:            number;
  isWithinServiceRadius: boolean;
  deliveryFee:           number;
}

export class DistanceUtil {

  private static readonly EARTH_RADIUS_KM = 6371;

  /* =====================================================
     COORDINATE VALIDATION
  ===================================================== */

  private static validateCoordinates(lat: number, lng: number): void {
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      throw new AppError('Invalid GPS coordinates', 400);
    }
    if (lat < -90  || lat > 90)  throw new AppError('Latitude out of range',  400);
    if (lng < -180 || lng > 180) throw new AppError('Longitude out of range', 400);
  }

  /* =====================================================
     HAVERSINE DISTANCE
  ===================================================== */

  static calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    this.validateCoordinates(lat1, lng1);
    this.validateCoordinates(lat2, lng2);

    const toRad = (deg: number) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((this.EARTH_RADIUS_KM * c).toFixed(2));
  }

  /* =====================================================
     EVALUATE DOORSTEP DELIVERY
     Returns fee = 0 if outside radius (not an error)
  ===================================================== */

  static evaluateDoorstep(
    customerLat: number,
    customerLng: number,
    agentLat:    number,
    agentLng:    number
  ): DistanceResult {

    const distanceKm = this.calculateDistanceKm(
      customerLat, customerLng,
      agentLat,    agentLng
    );

    const isWithinServiceRadius =
      distanceKm <= PRICING.MAX_SERVICE_RADIUS_KM;

    if (!isWithinServiceRadius) {
      return { distanceKm, isWithinServiceRadius: false, deliveryFee: 0 };
    }

    const deliveryFee = Math.round(
      distanceKm * PRICING.DELIVERY_PER_KM_INR +
      PRICING.DELIVERY_BASE_FEE_INR
    );

    return { distanceKm, isWithinServiceRadius: true, deliveryFee };
  }

  /* =====================================================
     CALCULATE DELIVERY FEE ONLY
     Use when distance is already known (snapshot)
  ===================================================== */

  static calculateDeliveryFee(distanceKm: number): number {
    if (distanceKm > PRICING.MAX_SERVICE_RADIUS_KM) return 0;
    return Math.round(
      distanceKm * PRICING.DELIVERY_PER_KM_INR +
      PRICING.DELIVERY_BASE_FEE_INR
    );
  }
}