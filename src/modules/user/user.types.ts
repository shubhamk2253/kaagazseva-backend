import { UserRole } from '../../core/constants';
import { PaginatedResponse } from '../../core/types';

/**
 * KAAGAZSEVA - User Module Types
 * Clean DTO layer between DB and Controller.
 */

/**
 * Public User Profile DTO
 * (Mapped from Prisma User + Wallet)
 */
export interface UserProfile {
  id: string;
  phoneNumber: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  walletBalance: number; // Derived from user.wallet.balance
  createdAt: Date;
}

/**
 * Input for updating profile
 */
export interface UpdateProfileInput {
  name?: string;
}

/**
 * Admin Query Filters
 */
export interface UserQueryFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Standard Paginated Response for Admin User List
 */
export type PaginatedUserResponse = PaginatedResponse<UserProfile>;