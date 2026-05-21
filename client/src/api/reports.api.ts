import client from "./client";
import type { ApiResponse } from "@/types";

export interface ReportsFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  departmentId?: string;
  customerGroup?: number;
}

export interface ReportStats {
  total: number;
  withAccount: number;
  withAgribankPlus: number;
  useMisa: number;
  useVnpay: number;
  group1: number;
  group2: number;
  group3: number;
  group4: number;
}

export interface NewCustomersReportResponse {
  stats: ReportStats;
}

export const reportsApi = {
  getData: (filters: ReportsFilters = {}) =>
    client.get<ApiResponse<NewCustomersReportResponse>>("/reports", { params: filters }),

  exportExcel: (filters: ReportsFilters = {}) =>
    client.get("/reports/export", {
      params: filters,
      responseType: "blob",
    }),

  exportPdf: (params: { dateFrom?: string; dateTo?: string } = {}) =>
    client.get("/reports/export-pdf", {
      params,
      responseType: "blob",
    }),

  exportBalanceByOrg: (filters: ReportsFilters = {}) =>
    client.get("/reports/export-balance", {
      params: filters,
      responseType: "blob",
    }),

  exportAccountThresholdByUnit: (filters: ReportsFilters = {}) =>
    client.get("/reports/export-account-threshold", {
      params: filters,
      responseType: "blob",
    }),
};
