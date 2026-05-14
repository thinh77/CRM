import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach access token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        queryClient.clear();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post("/api/auth/refresh", {
          refreshToken,
        });

        useAuthStore.getState().setTokens(
          data.data.accessToken,
          data.data.refreshToken
        );

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return client(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        queryClient.clear();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Global error toast for non-401 errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 403) {
      toast.error("Bạn không có quyền thực hiện thao tác này");
    } else if (status && status >= 500) {
      toast.error("Lỗi hệ thống, vui lòng thử lại sau");
    }
    return Promise.reject(error);
  }
);

export default client;
