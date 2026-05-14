import { Request, Response, NextFunction } from "express";
import * as customersService from "./customers.service.js";
import { success, created, paginated } from "../../utils/apiResponse.js";
import { customerQuerySchema, poolQuerySchema, claimSchema } from "./customers.schema.js";
import { AppError } from "../../middleware/errorHandler.js";

function canViewAll(req: Request): boolean {
  const perms = req.user!.permissions;
  return perms.includes("*") || perms.includes("customers:read_all");
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = customerQuerySchema.parse(req.query);
    const result = await customersService.list(
      query,
      req.user!.userId,
      canViewAll(req)
    );
    paginated(res, result.data, result.total, query.page, query.limit);
  } catch (err) {
    next(err);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customer = await customersService.getById(
      req.params.id as string,
      req.user!.userId,
      canViewAll(req)
    );
    success(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.create(
      req.body,
      req.user!.userId,
      req.ip as string
    );
    created(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.update(
      req.params.id as string,
      req.body,
      req.user!.userId,
      canViewAll(req),
      req.ip as string
    );
    success(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await customersService.remove(
      req.params.id as string,
      req.user!.userId,
      canViewAll(req),
      req.ip as string
    );
    success(res, { message: "Đã xóa khách hàng" });
  } catch (err) {
    next(err);
  }
}

export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await customersService.getStats(
      req.user!.userId,
      canViewAll(req)
    );
    success(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function importCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError("Vui lòng chọn file để import", 400);
    }
    const importType = req.body?.type === "mist81" ? "mist81" : "standard";
    const result = await customersService.importFromFile(
      req.file.buffer,
      req.file.originalname,
      req.user!.userId,
      req.ip as string,
      importType
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function exportCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const format = (req.query.format as string) || "xlsx";

    if (format === "csv") {
      const csv = await customersService.exportToCsv(req.user!.userId, canViewAll(req));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=khach-hang.csv");
      res.send(csv);
    } else {
      const buffer = await customersService.exportToExcel(req.user!.userId, canViewAll(req));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=khach-hang.xlsx");
      res.send(buffer);
    }
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mẫu nhập khách hàng");

    worksheet.columns = [
      { header: "Tên HKD", key: "businessName", width: 30 },
      { header: "Chủ hộ", key: "ownerName", width: 20 },
      { header: "Số ĐKKD", key: "registrationNumber", width: 15 },
      { header: "SĐT", key: "phone", width: 15 },
      { header: "Địa chỉ", key: "address", width: 30 },
      { header: "Tài khoản", key: "hasAccount", width: 10 },
      { header: "Số TK", key: "accountNumber", width: 20 },
      { header: "Số dư", key: "balance", width: 15 },
      { header: "Agribank Plus", key: "hasAgribankPlus", width: 12 },
      { header: "Phần mềm", key: "software", width: 10 },
      { header: "Nhóm", key: "customerGroup", width: 10 },
      { header: "CBTV", key: "consultantCode", width: 15 },
      { header: "Nguồn", key: "leadSource", width: 15 },
      { header: "Ghi chú", key: "notes", width: 30 },
      { header: "Ngày mở TK", key: "accountOpenedAt", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE6EA" } };

    // Add sample row
    worksheet.addRow({
      businessName: "HKD Nguyễn Văn A",
      ownerName: "Nguyễn Văn A",
      registrationNumber: "41A8012345",
      phone: "0901234567",
      address: "123 Nguyễn Huệ, Q.1, TP.HCM",
      hasAccount: "Có",
      accountNumber: "0123456789",
      balance: "5000000",
      hasAgribankPlus: "Có",
      software: "MISA",
      customerGroup: 1,
      consultantCode: "ADMIN001",
      leadSource: "Giới thiệu",
      notes: "Khách hàng VIP",
      accountOpenedAt: "15/03/2024",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=mau-nhap-khach-hang.xlsx");
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

export async function listPool(req: Request, res: Response, next: NextFunction) {
  try {
    const query = poolQuerySchema.parse(req.query);
    const result = await customersService.listPool(query);
    paginated(res, result.data, result.total, query.page, query.limit);
  } catch (err) {
    next(err);
  }
}

export async function claim(req: Request, res: Response, next: NextFunction) {
  try {
    const { customerIds } = claimSchema.parse(req.body);
    const result = await customersService.claimCustomers(
      customerIds,
      req.user!.userId,
      req.ip as string
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function unclaim(req: Request, res: Response, next: NextFunction) {
  try {
    const { customerIds } = claimSchema.parse(req.body);
    const result = await customersService.unclaimCustomers(
      customerIds,
      req.user!.userId,
      req.ip as string
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}
