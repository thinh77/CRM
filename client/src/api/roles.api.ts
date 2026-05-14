import client from "./client";
import type { Role, Permission } from "@/types";

export const rolesApi = {
  list: () =>
    client.get<{ success: boolean; data: Role[] }>("/roles"),

  getById: (id: string) =>
    client.get<{ success: boolean; data: Role }>(`/roles/${id}`),

  create: (data: { name: string; description?: string; permissionIds?: string[] }) =>
    client.post<{ success: boolean; data: Role }>("/roles", data),

  update: (id: string, data: { name?: string; description?: string }) =>
    client.put<{ success: boolean; data: Role }>(`/roles/${id}`, data),

  delete: (id: string) =>
    client.delete(`/roles/${id}`),

  assignPermissions: (id: string, permissionIds: string[]) =>
    client.put(`/roles/${id}/permissions`, { permissionIds }),

  listPermissions: () =>
    client.get<{ success: boolean; data: Permission[] }>("/roles/permissions"),
};
