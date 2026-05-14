import { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service.js";
import { success, created, paginated } from "../../utils/apiResponse.js";
import { userQuerySchema, consultantFilterSchema } from "./users.schema.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = userQuerySchema.parse(req.query);
    const result = await usersService.list(query);
    paginated(res, result.data, result.total, query.page, query.limit);
  } catch (err) {
    next(err);
  }
}

export async function listConsultants(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = consultantFilterSchema.parse(req.query);
    const data = await usersService.listConsultants(filters);
    success(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getById(req.params.id as string);
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function getPermissionOverrides(req: Request, res: Response, next: NextFunction) {
  try {
    const overrides = await usersService.getPermissionOverrides(req.params.id as string);
    success(res, overrides);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.create(req.body, req.user!.userId, req.ip as string);
    created(res, user);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.update(
      req.params.id as string,
      req.body,
      req.user!.userId,
      req.ip as string
    );
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.remove(req.params.id as string, req.user!.userId, req.ip as string);
    success(res, { message: "Đã xóa user" });
  } catch (err) {
    next(err);
  }
}

export async function assignRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.assignUserRoles(
      req.params.id as string,
      req.body,
      req.user!.userId,
      req.ip as string
    );
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function assignPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.assignUserPermissions(
      req.params.id as string,
      req.body,
      req.user!.userId,
      req.ip as string
    );
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function importUsers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError("Vui lòng chọn file để import", 400);
    }
    const result = await usersService.importFromFile(
      req.file.buffer,
      req.file.originalname,
      req.user!.userId,
      req.ip as string
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function exportUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const format = (req.query.format as string) || "xlsx";

    if (format === "csv") {
      const csv = await usersService.exportToCsv();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=nguoi-dung.csv");
      res.send(csv);
    } else {
      const buffer = await usersService.exportToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=nguoi-dung.xlsx");
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
    const worksheet = workbook.addWorksheet("Mẫu nhập người dùng");

    worksheet.columns = [
      { header: "Mã NV", key: "employeeCode", width: 15 },
      { header: "Họ tên", key: "fullName", width: 25 },
      { header: "Mật khẩu", key: "password", width: 20 },
      { header: "Chi nhánh", key: "branchCode", width: 15 },
      { header: "Phòng ban", key: "departmentName", width: 20 },
      { header: "Chức vụ", key: "positionName", width: 20 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE6EA" } };

    worksheet.addRow({
      employeeCode: "NV001",
      fullName: "Nguyễn Văn A",
      password: "Agribank@123",
      branchCode: "6421",
      departmentName: "Phòng KHCN",
      positionName: "Nhân viên",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=mau-nhap-nguoi-dung.xlsx");
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}
