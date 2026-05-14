import client from "./client";
import type { ApiResponse, PaginatedResponse, Customer } from "@/types";

export interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  software?: string;
  hasAccount?: boolean;
  hasAgribankPlus?: boolean;
  customerGroup?: number;
  consultantId?: string;
  branchId?: string;
  departmentId?: string;
  invalidAccount?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export type CustomerImportType = "standard" | "mist81";

export const customersApi = {
  list: (filters: CustomerFilters = {}) =>
    client.get<PaginatedResponse<Customer>>("/customers", { params: filters }),

  getById: (id: string) =>
    client.get<ApiResponse<Customer>>(`/customers/${id}`),

  create: (data: Partial<Customer>) =>
    client.post<ApiResponse<Customer>>("/customers", data),

  update: (id: string, data: Partial<Customer>) =>
    client.put<ApiResponse<Customer>>(`/customers/${id}`, data),

  delete: (id: string) =>
    client.delete(`/customers/${id}`),

  getStats: () =>
    client.get<ApiResponse<any>>("/customers/stats"),

  importFile: (file: File, type: CustomerImportType = "standard") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    return client.post<ApiResponse<{ success: number; updated: number; errors: { row: number; message: string }[] }>>(
      "/customers/import",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  exportFile: (format: "xlsx" | "csv" = "xlsx") =>
    client.get("/customers/export", {
      params: { format },
      responseType: "blob",
    }),

  downloadTemplate: () =>
    client.get("/customers/template", { responseType: "blob" }),
};
