import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Tên vai trò không được để trống").max(50),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional().nullable(),
});

export const assignRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignRolePermissionsInput = z.infer<typeof assignRolePermissionsSchema>;
