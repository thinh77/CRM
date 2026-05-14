import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler.js";
import { success } from "../../utils/apiResponse.js";
import * as reportsService from "./reports.service.js";
import { renderBranchDepartmentReportPdf } from "./reports.pdf.js";

function getDateQueryParam(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getUuidQueryParam(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
  return value;
}

function getIntQueryParam(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 4) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
  return num;
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: reportsService.ReportFilters = {
      dateFrom: getDateQueryParam(req.query.dateFrom, "dateFrom"),
      dateTo: getDateQueryParam(req.query.dateTo, "dateTo"),
      branchId: getUuidQueryParam(req.query.branchId, "branchId"),
      departmentId: getUuidQueryParam(req.query.departmentId, "departmentId"),
      customerGroup: getIntQueryParam(req.query.customerGroup, "customerGroup"),
    };
    const report = await reportsService.getNewCustomersReport(filters);
    success(res, report);
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: reportsService.ReportFilters = {
      dateFrom: getDateQueryParam(req.query.dateFrom, "dateFrom"),
      dateTo: getDateQueryParam(req.query.dateTo, "dateTo"),
      branchId: getUuidQueryParam(req.query.branchId, "branchId"),
      departmentId: getUuidQueryParam(req.query.departmentId, "departmentId"),
      customerGroup: getIntQueryParam(req.query.customerGroup, "customerGroup"),
    };
    const buffer = await reportsService.exportNewCustomersExcel(filters);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=bao-cao-khach-hang-moi.xlsx");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function exportPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFrom = getDateQueryParam(req.query.dateFrom, "dateFrom");
    const dateTo = getDateQueryParam(req.query.dateTo, "dateTo");

    const breakdown = await reportsService.getBranchDepartmentBreakdown(dateFrom, dateTo);

    const rangeSuffix = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : (dateFrom || dateTo || "toan-thoi-gian");
    const filename = `bao-cao-tong-hop-kh_${rangeSuffix}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = renderBranchDepartmentReportPdf(breakdown, { dateFrom, dateTo });
    stream.pipe(res);
    stream.on("error", next);
  } catch (err) {
    next(err);
  }
}

export async function exportBalanceByOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: reportsService.BalanceByOrgFilters = {
      dateFrom: getDateQueryParam(req.query.dateFrom, "dateFrom"),
      dateTo: getDateQueryParam(req.query.dateTo, "dateTo"),
      branchId: getUuidQueryParam(req.query.branchId, "branchId"),
      departmentId: getUuidQueryParam(req.query.departmentId, "departmentId"),
    };
    const buffer = await reportsService.exportBalanceByOrgExcel(filters);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bao-cao-so-du-theo-don-vi.xlsx"'
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
