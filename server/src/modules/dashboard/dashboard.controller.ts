import { Request, Response, NextFunction } from "express";
import * as dashboardService from "./dashboard.service.js";
import type { Period, TopConsultantType } from "./dashboard.service.js";
import { success } from "../../utils/apiResponse.js";

const VALID_PERIODS = new Set(["today", "week", "month"]);

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const canViewAll =
      req.user!.permissions.includes("*") ||
      req.user!.permissions.includes("customers:read_all") ||
      req.user!.permissions.includes("dashboard:read");

    const periodParam = req.query.period as string | undefined;
    const period = periodParam && VALID_PERIODS.has(periodParam)
      ? (periodParam as Period)
      : undefined;

    const stats = await dashboardService.getStats(req.user!.userId, canViewAll, period);
    success(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getTopConsultants(req: Request, res: Response, next: NextFunction) {
  try {
    const periodParam = req.query.period as string | undefined;
    const period = periodParam && VALID_PERIODS.has(periodParam)
      ? (periodParam as Period)
      : ("month" as Period);

    const typeParam = req.query.type as string | undefined;
    const type: TopConsultantType =
      typeParam === "total" || typeParam === "software" ? typeParam : "new";

    const data = await dashboardService.getTopConsultants(period, type);
    success(res, data);
  } catch (err) {
    next(err);
  }
}
