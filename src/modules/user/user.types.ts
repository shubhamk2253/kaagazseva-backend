import { UserRole } from '@prisma/client';
import { PaginatedResponse } from '../../core/types';

/**
 * KAAGAZSEVA - User Module Types
 * DTO layer between database entities and API responses.
 */

/* =====================================================
   PUBLIC USER PROFILE DTO
   (Returned to API consumers)
===================================================== */

export interface UserProfile {
  readonly id: string;
  readonly phoneNumber: string;
  readonly name: string | null;
  readonly role: UserRole;
  readonly isActive: boolean;

  /**
   * Derived field (wallet.balance)
   */
  readonly walletBalance: number;

  readonly createdAt: Date;
}

/* =====================================================
   PROFILE UPDATE INPUT
===================================================== */

export interface UpdateProfileInput {
  name?: string;
}

/* =====================================================
   ADMIN USER SEARCH FILTERS
===================================================== */

export interface UserQueryFilters {

  /**
   * Filter by role
   */
  role?: UserRole;

  /**
   * Filter active / suspended accounts
   */
  isActive?: boolean;

  /**
   * Search by name or phone number
   */
  search?: string;

  /**
   * Pagination
   */
  page?: number;
  limit?: number;
}

/* =====================================================
   ADMIN STATUS UPDATE INPUT
===================================================== */

export interface UpdateUserStatusInput {
  isActive: boolean;
}

/* =====================================================
   PAGINATED USER RESPONSE
===================================================== */

export type PaginatedUserResponse =
  PaginatedResponse<UserProfile>;