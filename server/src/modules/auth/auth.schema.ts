import { z } from "zod";

export const loginSchema = z.object({
  employeeCode: z.string().min(1, "Mã nhân viên không được để trống"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại không được để trống"),
  newPassword: z
    .string()
    .min(8, "Mật khẩu mới phải ít nhất 8 ký tự")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt"
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
