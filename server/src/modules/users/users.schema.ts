import { z } from "zod";

const userPasswordSchema = z
  .string()
  .min(8, "Mật khẩu phải ít nhất 8 ký tự")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
    "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt"
  );

export const createUserSchema = z.object({
  employeeCode: z.string().min(1, "Mã nhân viên không được để trống").max(20),
  password: userPasswordSchema,
  fullName: z.string().min(1, "Họ tên không được để trống").max(100),
  branchId: z.string().uuid("Chi nhánh không hợp lệ").optional().nullable(),
  departmentId: z.string().uuid("Phòng ban không hợp lệ").optional().nullable(),
  positionId: z.string().uuid("Chức vụ không hợp lệ").optional().nullable(),
  roleIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  password: userPasswordSchema.optional(),
  branchId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});

export const assignPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permissionId: z.string().uuid(),
      granted: z.boolean(),
    })
  ),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.preprocess((value) => {
    if (value === "true" || value === true) {
      return true;
    }
    if (value === "false" || value === false) {
      return false;
    }
    return value;
  }, z.boolean().optional()),
});

export const consultantFilterSchema = z.object({
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type ConsultantFilter = z.infer<typeof consultantFilterSchema>;
