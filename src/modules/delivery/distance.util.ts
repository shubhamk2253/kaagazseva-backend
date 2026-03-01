/**
 * KAAGAZSEVA - Delivery Distance Utility
 * FREE distance calculation using Haversine formula.
 * No Google API cost.
 */

export interface DistanceResult {
  distanceKm: number;
  isWithinServiceRadius: boolean;
  deliveryFee: number;
}

export class DistanceUtil {

  /**
   * Earth radius in KM
   */
  private static readonly EARTH_RADIUS_KM = 6371;

  /**
   * Max doorstep radius
   */
  private static readonly MAX_RADIUS_KM = 25;

  /**
   * Delivery fee constants
   */
  private static readonly PER_KM_RATE = 12;
  private static readonly BASE_FEE = 30;

  //////////////////////////////////////////////////////
  // 1️⃣ Haversine Formula
  //////////////////////////////////////////////////////

  static calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {

    const toRadians = (degree: number) =>
      degree * (Math.PI / 180);

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = this.EARTH_RADIUS_KM * c;

    return Number(distance.toFixed(2)); // 2 decimal precision
  }

  //////////////////////////////////////////////////////
  // 2️⃣ Delivery Logic Wrapper
  //////////////////////////////////////////////////////

  static evaluateDoorstep(
    customerLat: number,
    customerLng: number,
    agentLat: number,
    agentLng: number
  ): DistanceResult {

    const distanceKm = this.calculateDistanceKm(
      customerLat,
      customerLng,
      agentLat,
      agentLng
    );

    const isWithinServiceRadius =
      distanceKm <= this.MAX_RADIUS_KM;

    // If outside radius → no doorstep
    if (!isWithinServiceRadius) {
      return {
        distanceKm,
        isWithinServiceRadius: false,
        deliveryFee: 0,
      };
    }

    const deliveryFee =
      Math.round(
        distanceKm * this.PER_KM_RATE +
        this.BASE_FEE
      );

    return {
      distanceKm,
      isWithinServiceRadius: true,
      deliveryFee,
    };
  }
}