import client from "./client";
import type { PaginatedResponse } from "@/types";

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  employeeCode: string | null;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  resource?: string;
}

export const auditLogsApi = {
  list: (filters: AuditLogFilters = {}) =>
    client.get<PaginatedResponse<AuditLog>>("/audit-logs", { params: filters }),
};
