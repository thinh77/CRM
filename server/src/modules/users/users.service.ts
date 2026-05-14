import { db } from "../../config/database.js";
import { users, userRoles, userPermissions } from "../../db/schema/users.js";
import { branches, departments, positions } from "../../db/schema/organization.js";
import { roles } from "../../db/schema/roles.js";
import { auditLogs } from "../../db/schema/auditLogs.js";
import { eq, and, or, ilike, count } from "drizzle-orm";
import { hashPassword } from "../../utils/password.js";
import { AppError } from "../../middleware/errorHandler.js";
import { getUserPermissions } from "../../middleware/auth.middleware.js";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type {
  CreateUserInput,
  UpdateUserInput,
  AssignRolesInput,
  AssignPermissionsInput,
  UserQuery,
  ConsultantFilter,
} from "./users.schema.js";

function getCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (Array.isArray(objectValue.richText)) {
      return objectValue.richText
        .map((segment) => {
          if (segment && typeof segment === "object" && "text" in segment) {
            return String((segment as { text?: unknown }).text ?? "");
          }
          return "";
        })
        .join("")
        .trim();
    }

    if (objectValue.result !== undefined) {
      return getCellText(objectValue.result);
    }

    if (typeof objectValue.text === "string") {
      return objectValue.text.trim();
    }

    if (typeof objectValue.hyperlink === "string") {
      return objectValue.hyperlink.trim();
    }
  }

  return String(value).trim();
}

export async function list(query: UserQuery) {
  const conditions = [];

  if (query.search) {
    conditions.push(
      or(
        ilike(users.employeeCode, `%${query.search}%`),
        ilike(users.fullName, `%${query.search}%`)
      )!
    );
  }

  if (query.branchId) {
    conditions.push(eq(users.branchId, query.branchId));
  }

  if (query.departmentId) {
    conditions.push(eq(users.departmentId, query.departmentId));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(users.isActive, query.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        employeeCode: users.employeeCode,
        fullName: users.fullName,
        branchId: users.branchId,
        departmentId: users.departmentId,
        positionId: users.positionId,
        branchName: branches.name,
        departmentName: departments.name,
        positionName: positions.name,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(branches, eq(users.branchId, branches.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(positions, eq(users.positionId, positions.id))
      .where(whereClause)
      .limit(query.limit)
      .offset(offset)
      .orderBy(users.createdAt),
    db.select({ total: count() }).from(users).where(whereClause),
  ]);

  return { data, total };
}

export async function listConsultants(filters?: ConsultantFilter) {
  const conditions = [eq(users.isActive, true)];

  if (filters?.branchId) {
    conditions.push(eq(users.branchId, filters.branchId));
  }

  if (filters?.departmentId) {
    conditions.push(eq(users.departmentId, filters.departmentId));
  }

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      employeeCode: users.employeeCode,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(users.fullName);
}

export async function getById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      branchId: users.branchId,
      departmentId: users.departmentId,
      positionId: users.positionId,
      branchName: branches.name,
      departmentName: departments.name,
      positionName: positions.name,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(positions, eq(users.positionId, positions.id))
    .where(eq(users.id, id));

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Get user roles
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, id));

  // Get user permissions (deduplicated)
  const perms = await getUserPermissions(id);

  return { ...user, roles: userRoleRows, permissions: perms };
}

export async function create(input: CreateUserInput, adminUserId: string, ip?: string) {
  // Check duplicate employee code
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.employeeCode, input.employeeCode));

  if (existing) {
    throw new AppError("Mã nhân viên đã tồn tại", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const { password, roleIds, ...userData } = input;

  const [user] = await db
    .insert(users)
    .values({ ...userData, passwordHash })
    .returning();

  // Assign roles if provided
  if (roleIds && roleIds.length > 0) {
    await db.insert(userRoles).values(
      roleIds.map((roleId) => ({ userId: user.id, roleId }))
    );
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "CREATE",
    resource: "users",
    resourceId: user.id,
    newData: { employeeCode: user.employeeCode, fullName: user.fullName },
    ipAddress: ip,
  });

  return getById(user.id);
}

export async function update(
  id: string,
  input: UpdateUserInput,
  adminUserId: string,
  ip?: string
) {
  const existing = await getById(id);
  const { password, ...updateInput } = input;
  const updateData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
    ...updateInput,
    updatedAt: new Date(),
  };

  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "UPDATE",
    resource: "users",
    resourceId: id,
    oldData: existing,
    newData: { fullName: updated.fullName, isActive: updated.isActive, passwordChanged: Boolean(password) },
    ipAddress: ip,
  });

  return getById(id);
}

export async function remove(id: string, adminUserId: string, ip?: string) {
  const existing = await getById(id);

  // Check if trying to delete system admin
  const userRoleRows = await db
    .select({ isSystem: roles.isSystem })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, id), eq(roles.isSystem, true)));

  if (userRoleRows.length > 0) {
    throw new AppError("Không thể xóa tài khoản admin hệ thống", 403);
  }

  await db.delete(users).where(eq(users.id, id));

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "DELETE",
    resource: "users",
    resourceId: id,
    oldData: existing,
    ipAddress: ip,
  });
}

export async function assignUserRoles(
  id: string,
  input: AssignRolesInput,
  adminUserId: string,
  ip?: string
) {
  await getById(id); // Verify user exists

  // Remove existing roles
  await db.delete(userRoles).where(eq(userRoles.userId, id));

  // Assign new roles
  if (input.roleIds.length > 0) {
    await db
      .insert(userRoles)
      .values(input.roleIds.map((roleId) => ({ userId: id, roleId })));
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "UPDATE",
    resource: "users",
    resourceId: id,
    newData: { roles: input.roleIds },
    ipAddress: ip,
  });

  return getById(id);
}

export async function assignUserPermissions(
  id: string,
  input: AssignPermissionsInput,
  adminUserId: string,
  ip?: string
) {
  await getById(id); // Verify user exists

  // Remove existing overrides
  await db.delete(userPermissions).where(eq(userPermissions.userId, id));

  // Insert new overrides
  if (input.permissions.length > 0) {
    await db.insert(userPermissions).values(
      input.permissions.map((p) => ({
        userId: id,
        permissionId: p.permissionId,
        granted: p.granted,
      }))
    );
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "UPDATE",
    resource: "users",
    resourceId: id,
    newData: { permissions: input.permissions },
    ipAddress: ip,
  });

  return getById(id);
}

export async function getPermissionOverrides(id: string) {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));

  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  return db
    .select({
      permissionId: userPermissions.permissionId,
      granted: userPermissions.granted,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, id));
}

export async function importFromFile(
  buffer: Buffer,
  filename: string,
  adminUserId: string,
  ip?: string
): Promise<{ success: number; errors: { row: number; message: string }[] }> {
  const ext = filename.toLowerCase().split(".").pop();
  let rows: Record<string, any>[];

  if (ext === "csv") {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new AppError("File Excel không có sheet nào", 400);

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = getCellText(cell.value);
    });

    rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) obj[header] = getCellText(cell.value);
      });
      rows.push(obj);
    });
  }

  const columnMap: Record<string, string> = {
    "Mã NV": "employeeCode",
    "Mã nhân viên": "employeeCode",
    "employeeCode": "employeeCode",
    "Họ tên": "fullName",
    "fullName": "fullName",
    "Mật khẩu": "password",
    "password": "password",
    "Chi nhánh": "branchCode",
    "Mã chi nhánh": "branchCode",
    "branchCode": "branchCode",
    "Phòng ban": "department",
    "department": "department",
    "Chức vụ": "position",
    "position": "position",
  };

  const results = { success: 0, errors: [] as { row: number; message: string }[] };
  const [staffRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, "staff"));

  if (!staffRole) {
    throw new AppError("Không tìm thấy vai trò mặc định staff", 500);
  }

  for (let i = 0; i < rows.length; i++) {
    try {
      const raw = rows[i];
      const mapped: Record<string, any> = {};

      for (const [key, value] of Object.entries(raw)) {
        const field = columnMap[key.trim()];
        if (field) mapped[field] = value;
      }

      if (!mapped.employeeCode || !mapped.fullName || !mapped.branchCode) {
        results.errors.push({ row: i + 2, message: "Thiếu mã NV, họ tên hoặc chi nhánh" });
        continue;
      }

      // Check duplicate
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeCode, String(mapped.employeeCode)));

      if (existing) {
        results.errors.push({ row: i + 2, message: `Mã NV "${mapped.employeeCode}" đã tồn tại` });
        continue;
      }

      // Look up branchId by code
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.code, String(mapped.branchCode)));

      if (!branch) {
        results.errors.push({ row: i + 2, message: `Chi nhánh "${mapped.branchCode}" không tồn tại` });
        continue;
      }

      // Look up departmentId by name + branchId
      let departmentId: string | null = null;
      if (mapped.department) {
        const [dept] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.name, String(mapped.department)), eq(departments.branchId, branch.id)));
        departmentId = dept?.id ?? null;
      }

      // Look up positionId by name
      let positionId: string | null = null;
      if (mapped.position) {
        const [pos] = await db
          .select({ id: positions.id })
          .from(positions)
          .where(eq(positions.name, String(mapped.position)));
        positionId = pos?.id ?? null;
      }

      // Default password if not provided
      const password = mapped.password ? String(mapped.password) : "Agribank@123";
      const passwordHash = await hashPassword(password);

      await db.transaction(async (tx) => {
        const [createdUser] = await tx
          .insert(users)
          .values({
            employeeCode: String(mapped.employeeCode),
            passwordHash,
            fullName: String(mapped.fullName),
            branchId: branch.id,
            departmentId,
            positionId,
          })
          .returning({ id: users.id });

        await tx.insert(userRoles).values({
          userId: createdUser.id,
          roleId: staffRole.id,
        });
      });

      results.success++;
    } catch (err: any) {
      results.errors.push({ row: i + 2, message: err.message || "Lỗi không xác định" });
    }
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId: adminUserId,
    action: "IMPORT",
    resource: "users",
    newData: { filename, success: results.success, errors: results.errors.length },
    ipAddress: ip,
  });

  return results;
}

export async function exportToExcel(): Promise<Buffer> {
  const data = await db
    .select({
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      branchName: branches.name,
      departmentName: departments.name,
      positionName: positions.name,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(positions, eq(users.positionId, positions.id))
    .orderBy(users.employeeCode);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Người dùng");

  worksheet.columns = [
    { header: "Mã NV", key: "employeeCode", width: 15 },
    { header: "Họ tên", key: "fullName", width: 25 },
    { header: "Chi nhánh", key: "branchName", width: 20 },
    { header: "Phòng ban", key: "departmentName", width: 20 },
    { header: "Chức vụ", key: "positionName", width: 20 },
    { header: "Trạng thái", key: "isActive", width: 12 },
    { header: "Đăng nhập cuối", key: "lastLogin", width: 20 },
    { header: "Ngày tạo", key: "createdAt", width: 20 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE6EA" } };

  for (const row of data) {
    worksheet.addRow({
      ...row,
      branchName: row.branchName || "",
      departmentName: row.departmentName || "",
      positionName: row.positionName || "",
      isActive: row.isActive ? "Hoạt động" : "Vô hiệu",
      lastLogin: row.lastLogin ? row.lastLogin.toLocaleString("vi-VN") : "",
      createdAt: row.createdAt.toLocaleString("vi-VN"),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportToCsv(): Promise<string> {
  const data = await db
    .select({
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      branchName: branches.name,
      departmentName: departments.name,
      positionName: positions.name,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(positions, eq(users.positionId, positions.id))
    .orderBy(users.employeeCode);

  const rows = data.map((row) => ({
    "Mã NV": row.employeeCode,
    "Họ tên": row.fullName,
    "Chi nhánh": row.branchName || "",
    "Phòng ban": row.departmentName || "",
    "Chức vụ": row.positionName || "",
    "Trạng thái": row.isActive ? "Hoạt động" : "Vô hiệu",
    "Đăng nhập cuối": row.lastLogin ? row.lastLogin.toLocaleString("vi-VN") : "",
    "Ngày tạo": row.createdAt.toLocaleString("vi-VN"),
  }));

  return stringify(rows, { header: true, bom: true });
}
