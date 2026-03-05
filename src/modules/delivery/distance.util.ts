/**
 * KAAGAZSEVA - Delivery Distance Utility
 * Haversine based geo calculation.
 */

import { AppError } from '../../core/AppError';

export interface DistanceResult {
  distanceKm: number;
  isWithinServiceRadius: boolean;
  deliveryFee: number;
}

export class DistanceUtil {

  private static readonly EARTH_RADIUS_KM = 6371;

  private static readonly MAX_RADIUS_KM = 25;

  private static readonly PER_KM_RATE = 12;

  private static readonly BASE_FEE = 30;

  //////////////////////////////////////////////////////
  // Coordinate Validation
  //////////////////////////////////////////////////////

  private static validateCoordinates(lat: number, lng: number) {

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {

      throw new AppError('Invalid GPS coordinates', 400);

    }

    if (lat < -90 || lat > 90) {
      throw new AppError('Latitude out of range', 400);
    }

    if (lng < -180 || lng > 180) {
      throw new AppError('Longitude out of range', 400);
    }

  }

  //////////////////////////////////////////////////////
  // Haversine Formula
  //////////////////////////////////////////////////////

  static calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {

    this.validateCoordinates(lat1, lng1);
    this.validateCoordinates(lat2, lng2);

    const toRadians = (degree: number) =>
      degree * (Math.PI / 180);

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = this.EARTH_RADIUS_KM * c;

    return Number(distance.toFixed(2));

  }

  //////////////////////////////////////////////////////
  // Doorstep Delivery Evaluation
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