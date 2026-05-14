import client from "./client";
import type { ApiResponse, AuthTokens } from "@/types";

export const authApi = {
  login: (employeeCode: string, password: string) =>
    client.post<ApiResponse<AuthTokens>>("/auth/login", {
      employeeCode,
      password,
    }),

  refresh: (refreshToken: string) =>
    client.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      "/auth/refresh",
      { refreshToken }
    ),

  logout: () => client.post("/auth/logout"),

  getMe: () => client.get<ApiResponse<any>>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    client.put("/auth/change-password", { currentPassword, newPassword }),
};
