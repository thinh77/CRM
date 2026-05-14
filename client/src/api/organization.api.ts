import client from "./client";
import type { ApiResponse, Branch, Department, Position } from "@/types";

export const organizationApi = {
  // Branches
  listBranches: () =>
    client.get<ApiResponse<Branch[]>>("/organization/branches").then((res) => res.data.data),

  createBranch: (data: { code: string; name: string }) =>
    client.post<ApiResponse<Branch>>("/organization/branches", data).then((res) => res.data.data),

  updateBranch: (id: string, data: { code?: string; name?: string; isActive?: boolean }) =>
    client.put<ApiResponse<Branch>>(`/organization/branches/${id}`, data).then((res) => res.data.data),

  deleteBranch: (id: string) =>
    client.delete(`/organization/branches/${id}`),

  // Departments
  listDepartments: (branchId?: string) =>
    client.get<ApiResponse<Department[]>>("/organization/departments", {
      params: branchId ? { branchId } : undefined,
    }).then((res) => res.data.data),

  createDepartment: (data: { name: string; branchId: string }) =>
    client.post<ApiResponse<Department>>("/organization/departments", data).then((res) => res.data.data),

  updateDepartment: (id: string, data: { name?: string; branchId?: string; isActive?: boolean }) =>
    client.put<ApiResponse<Department>>(`/organization/departments/${id}`, data).then((res) => res.data.data),

  deleteDepartment: (id: string) =>
    client.delete(`/organization/departments/${id}`),

  // Positions
  listPositions: () =>
    client.get<ApiResponse<Position[]>>("/organization/positions").then((res) => res.data.data),

  createPosition: (data: { name: string; level: number }) =>
    client.post<ApiResponse<Position>>("/organization/positions", data).then((res) => res.data.data),

  updatePosition: (id: string, data: { name?: string; level?: number; isActive?: boolean }) =>
    client.put<ApiResponse<Position>>(`/organization/positions/${id}`, data).then((res) => res.data.data),

  deletePosition: (id: string) =>
    client.delete(`/organization/positions/${id}`),
};
