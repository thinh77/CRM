import client from "./client";
import type { ApiResponse, PaginatedResponse, Customer } from "@/types";

export interface PoolFilters {
  page?: number;
  limit?: number;
  search?: string;
  software?: string;
  hasAccount?: boolean;
  hasAgribankPlus?: boolean;
  customerGroup?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface ClaimResult {
  claimed: number;
  alreadyClaimed: number;
}

export interface UnclaimResult {
  unclaimed: number;
}

export const poolApi = {
  list: (filters: PoolFilters = {}) =>
    client.get<PaginatedResponse<Customer>>("/customers/pool", { params: filters }),

  claim: (customerIds: string[]) =>
    client.post<ApiResponse<ClaimResult>>("/customers/pool/claim", { customerIds }),

  unclaim: (customerIds: string[]) =>
    client.post<ApiResponse<UnclaimResult>>("/customers/pool/unclaim", { customerIds }),
};
