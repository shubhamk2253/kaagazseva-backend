/**
 * KAAGAZSEVA - Pricing Engine
 * Founder-Level Pricing Intelligence Layer
 */

import { DistanceUtil } from '../delivery/distance.util';

export interface PricingInput {
  govtFee: number;
  mode: 'DIGITAL' | 'DOORSTEP';
  customerLat?: number;
  customerLng?: number;
  agentLat?: number;
  agentLng?: number;
}

export interface PricingOutput {
  govtFee: number;
  serviceFee: number;
  platformCommission: number;
  agentCommission: number;
  deliveryFee: number;
  totalAmount: number;
  distanceKm?: number;
}

export class PricingEngine {

  private static readonly MIN_SERVICE_FEE = 99;
  private static readonly MAX_SERVICE_FEE = 800;

  private static readonly PLATFORM_PERCENT = 0.25;
  private static readonly PLATFORM_MIN = 30;

  ///////////////////////////////////////////////////////
  // MAIN CALCULATOR
  ///////////////////////////////////////////////////////

  static calculate(input: PricingInput): PricingOutput {

    const { govtFee, mode } = input;

    if (govtFee === undefined || govtFee <= 0) {
      throw new Error('Invalid government fee');
    }

    /////////////////////////////////////////////////////
    // 1️⃣ SERVICE FEE
    /////////////////////////////////////////////////////

    const serviceFee = this.calculateServiceFee(govtFee);

    /////////////////////////////////////////////////////
    // 2️⃣ COMMISSION SPLIT
    /////////////////////////////////////////////////////

    const rawPlatformCommission = serviceFee * this.PLATFORM_PERCENT;

    const platformCommission = Math.round(
      Math.max(rawPlatformCommission, this.PLATFORM_MIN)
    );

    const agentCommission = Math.round(
      serviceFee - platformCommission
    );

    /////////////////////////////////////////////////////
    // 3️⃣ DELIVERY CALCULATION
    /////////////////////////////////////////////////////

    let deliveryFee = 0;
    let distanceKm: number | undefined;

    if (
      mode === 'DOORSTEP' &&
      input.customerLat !== undefined &&
      input.customerLng !== undefined &&
      input.agentLat !== undefined &&
      input.agentLng !== undefined
    ) {

      const result = DistanceUtil.evaluateDoorstep(
        input.customerLat,
        input.customerLng,
        input.agentLat,
        input.agentLng
      );

      if (!result.isWithinServiceRadius) {
        throw new Error('Doorstep service not available beyond 25 KM');
      }

      distanceKm = result.distanceKm;
      deliveryFee = result.deliveryFee;
    }

    /////////////////////////////////////////////////////
    // 4️⃣ TOTAL AMOUNT
    /////////////////////////////////////////////////////

    const totalAmount = Math.round(
      govtFee + serviceFee + deliveryFee
    );

    /////////////////////////////////////////////////////
    // RETURN PRICING OBJECT
    /////////////////////////////////////////////////////

    return {
      govtFee,
      serviceFee,
      platformCommission,
      agentCommission,
      deliveryFee,
      totalAmount,
      distanceKm,
    };
  }

  ///////////////////////////////////////////////////////
  // SERVICE FEE LOGIC
  ///////////////////////////////////////////////////////

  private static calculateServiceFee(govtFee: number): number {

    let multiplier = 1;

    if (govtFee <= 200) {
      multiplier = 2.5;
    } else if (govtFee <= 1000) {
      multiplier = 1.5;
    } else if (govtFee <= 3000) {
      multiplier = 1.0;
    } else {
      multiplier = 0.6;
    }

    let serviceFee = govtFee * multiplier;

    if (serviceFee < this.MIN_SERVICE_FEE) {
      serviceFee = this.MIN_SERVICE_FEE;
    }

    if (serviceFee > this.MAX_SERVICE_FEE) {
      serviceFee = this.MAX_SERVICE_FEE;
    }

    return Math.round(serviceFee);
  }

}