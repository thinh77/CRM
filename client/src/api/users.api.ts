import client from "./client";
import type { ApiResponse, PaginatedResponse, User } from "@/types";

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface UserPermissionOverride {
  permissionId: string;
  granted: boolean;
}

export const usersApi = {
  list: (filters: UserFilters = {}) =>
    client.get<PaginatedResponse<User>>("/users", { params: filters }),

  listConsultants: (params?: { branchId?: string; departmentId?: string }) =>
    client.get<ApiResponse<{ id: string; fullName: string; employeeCode: string }[]>>(
      "/users/consultants",
      { params }
    ),

  getById: (id: string) =>
    client.get<ApiResponse<User>>(`/users/${id}`),

  create: (data: any) =>
    client.post<ApiResponse<User>>("/users", data),

  update: (id: string, data: any) =>
    client.put<ApiResponse<User>>(`/users/${id}`, data),

  delete: (id: string) =>
    client.delete(`/users/${id}`),

  assignRoles: (id: string, roleIds: string[]) =>
    client.put(`/users/${id}/roles`, { roleIds }),

  assignPermissions: (id: string, permissions: { permissionId: string; granted: boolean }[]) =>
    client.put(`/users/${id}/permissions`, { permissions }),

  getPermissionOverrides: (id: string) =>
    client.get<ApiResponse<UserPermissionOverride[]>>(`/users/${id}/permission-overrides`),

  importFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return client.post<ApiResponse<{ success: number; errors: { row: number; message: string }[] }>>(
      "/users/import",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  exportFile: (format: "xlsx" | "csv" = "xlsx") =>
    client.get("/users/export", {
      params: { format },
      responseType: "blob",
    }),

  downloadTemplate: () =>
    client.get("/users/template", { responseType: "blob" }),
};
