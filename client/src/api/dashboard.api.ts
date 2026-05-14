import client from "./client";
import type { ApiResponse, DashboardStats, TopConsultant } from "@/types";

export type DashboardPeriod = "today" | "week" | "month";
export type TopConsultantType = "total" | "new" | "software";

export const dashboardApi = {
  getStats: (period?: DashboardPeriod) =>
    client.get<ApiResponse<DashboardStats>>("/dashboard/stats", {
      params: period ? { period } : undefined,
    }),

  getTopConsultants: (period: DashboardPeriod, type: TopConsultantType) =>
    client.get<ApiResponse<TopConsultant[]>>("/dashboard/top-consultants", {
      params: { period, type },
    }),
};
