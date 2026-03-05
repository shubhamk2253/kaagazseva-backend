import { ServiceMode } from '@prisma/client';

export interface PricingInput {

  serviceId: string

  mode: ServiceMode

  customerLat?: number
  customerLng?: number

}

export interface PricingOutput {

  govtFee: number

  serviceFee: number

  platformCommission: number

  agentCommission: number

  deliveryFee: number

  totalAmount: number

}