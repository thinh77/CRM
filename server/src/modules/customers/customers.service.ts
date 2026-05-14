import { db } from "../../config/database.js";
import { customers } from "../../db/schema/customers.js";
import { users } from "../../db/schema/users.js";
import { auditLogs } from "../../db/schema/auditLogs.js";
import { eq, and, or, ilike, sql, asc, desc, count, inArray, isNull } from "drizzle-orm";
import { AppError } from "../../middleware/errorHandler.js";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { createCustomerSchema } from "./customers.schema.js";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQuery,
  PoolQuery,
} from "./customers.schema.js";

export type CustomerImportType = "standard" | "mist81" | "agribankPlus";

export interface CustomerImportResult {
  success: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  skippedRows: { row: number; message: string }[];
}

type FormulaResolver = (formula: string) => unknown;

function parseDirectFormulaReference(formula: string): { sheetName?: string; address: string } | undefined {
  const normalized = formula.trim().replace(/^=/, "");

  const quotedSheetReference = /^'((?:[^']|'')+)'!\$?([A-Za-z]+)\$?(\d+)$/.exec(normalized);
  if (quotedSheetReference) {
    return {
      sheetName: quotedSheetReference[1].replace(/''/g, "'"),
      address: `${quotedSheetReference[2].toUpperCase()}${quotedSheetReference[3]}`,
    };
  }

  const sheetReference = /^([^!]+)!\$?([A-Za-z]+)\$?(\d+)$/.exec(normalized);
  if (sheetReference) {
    return {
      sheetName: sheetReference[1],
      address: `${sheetReference[2].toUpperCase()}${sheetReference[3]}`,
    };
  }

  const sameSheetReference = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(normalized);
  if (sameSheetReference) {
    return {
      address: `${sameSheetReference[1].toUpperCase()}${sameSheetReference[2]}`,
    };
  }

  return undefined;
}

function createExcelFormulaResolver(
  workbook: ExcelJS.Workbook,
  currentWorksheet: ExcelJS.Worksheet
): FormulaResolver {
  return (formula) => {
    const reference = parseDirectFormulaReference(formula);
    if (!reference) return undefined;

    const targetWorksheet = reference.sheetName
      ? workbook.getWorksheet(reference.sheetName)
      : currentWorksheet;
    return targetWorksheet?.getCell(reference.address).value;
  };
}

function getCellText(value: unknown, resolveFormula?: FormulaResolver): string {
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
      return getCellText(objectValue.result, resolveFormula);
    }

    if (typeof objectValue.formula === "string" && resolveFormula) {
      const resolvedValue = resolveFormula(objectValue.formula);
      if (resolvedValue !== undefined) {
        return getCellText(resolvedValue, resolveFormula);
      }
    }

    if (typeof objectValue.text === "string") {
      return objectValue.text.trim();
    }

    if (typeof objectValue.hyperlink === "string") {
      return objectValue.hyperlink.trim();
    }

    // Formula without computed result or direct reference — cannot extract value
    if (typeof objectValue.formula === "string" || typeof objectValue.sharedFormula === "string") {
      return "";
    }

    // Error value — skip
    if (objectValue.error !== undefined) {
      return "";
    }

    // Unknown object type — return empty string instead of "[object Object]"
    return "";
  }

  return String(value).trim();
}

export function parseDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;

  // Already a Date object (from ExcelJS formatted cells)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }

  // Excel serial date number
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  // Try D/M/YYYY or D/M/YY format (slash separator)
  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (slashDate) {
    const day = parseInt(slashDate[1], 10);
    const month = parseInt(slashDate[2], 10);
    let year = parseInt(slashDate[3], 10);
    if (year < 100) year += 2000; // 2-digit year → 20xx
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return undefined;
  }

  // Try D-M-YYYY or D-M-YY format (dash separator)
  const dashDate = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(trimmed);
  if (dashDate) {
    const day = parseInt(dashDate[1], 10);
    const month = parseInt(dashDate[2], 10);
    let year = parseInt(dashDate[3], 10);
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return undefined;
  }

  // Try ISO string (from getCellText converting Date to ISO)
  if (trimmed.includes("T") || trimmed.includes("-")) {
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeHeaderKey(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized?.toLowerCase().replace(/[\s_-]+/g, "");
}

export async function list(query: CustomerQuery, userId: string, canViewAll: boolean) {
  const conditions = [];

  // Row-level security: only see own customers unless has read_all
  if (!canViewAll) {
    conditions.push(eq(customers.consultantId, userId));
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(customers.businessName, `%${query.search}%`),
        ilike(customers.ownerName, `%${query.search}%`),
        ilike(customers.customerCode, `%${query.search}%`),
        ilike(customers.phone, `%${query.search}%`),
        ilike(customers.registrationNumber, `%${query.search}%`),
        ilike(customers.accountNumber, `%${query.search}%`)
      )!
    );
  }

  if (query.software) {
    conditions.push(eq(customers.software, query.software));
  }

  if (query.hasAccount !== undefined) {
    conditions.push(eq(customers.hasAccount, query.hasAccount));
  }

  if (query.hasAgribankPlus !== undefined) {
    conditions.push(eq(customers.hasAgribankPlus, query.hasAgribankPlus));
  }

  if (query.customerGroup !== undefined) {
    conditions.push(eq(customers.customerGroup, query.customerGroup));
  }

  if (query.consultantId) {
    conditions.push(eq(customers.consultantId, query.consultantId));
  }

  if (query.branchId) {
    conditions.push(eq(users.branchId, query.branchId));
  }

  if (query.departmentId) {
    conditions.push(eq(users.departmentId, query.departmentId));
  }

  if (query.invalidAccount) {
    conditions.push(
      sql`${customers.accountNumber} IS NOT NULL AND ${customers.accountNumber} !~ '^[0-9]{13}$'`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    businessName: customers.businessName,
    ownerName: customers.ownerName,
    createdAt: customers.createdAt,
    balance: customers.balance,
  }[query.sortBy];

  const orderFn = query.sortOrder === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.limit;

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: customers.id,
        businessName: customers.businessName,
        ownerName: customers.ownerName,
        customerCode: customers.customerCode,
        registrationNumber: customers.registrationNumber,
        phone: customers.phone,
        address: customers.address,
        hasAccount: customers.hasAccount,
        accountNumber: customers.accountNumber,
        balance: customers.balance,
        hasAgribankPlus: customers.hasAgribankPlus,
        software: customers.software,
        consultantId: customers.consultantId,
        consultantName: users.fullName,
        customerGroup: customers.customerGroup,
        leadSource: customers.leadSource,
        notes: customers.notes,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .leftJoin(users, eq(customers.consultantId, users.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(customers)
      .leftJoin(users, eq(customers.consultantId, users.id))
      .where(whereClause),
  ]);

  return { data, total };
}

export async function getById(id: string, userId: string, canViewAll: boolean) {
  const conditions = [eq(customers.id, id)];
  if (!canViewAll) {
    conditions.push(eq(customers.consultantId, userId));
  }

  const [customer] = await db
    .select({
      id: customers.id,
      businessName: customers.businessName,
      ownerName: customers.ownerName,
      customerCode: customers.customerCode,
      registrationNumber: customers.registrationNumber,
      phone: customers.phone,
      address: customers.address,
      hasAccount: customers.hasAccount,
      accountNumber: customers.accountNumber,
      balance: customers.balance,
      hasAgribankPlus: customers.hasAgribankPlus,
      software: customers.software,
      consultantId: customers.consultantId,
      consultantName: users.fullName,
      customerGroup: customers.customerGroup,
      leadSource: customers.leadSource,
      notes: customers.notes,
      createdBy: customers.createdBy,
      updatedBy: customers.updatedBy,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .where(and(...conditions));

  if (!customer) {
    throw new AppError("Không tìm thấy khách hàng", 404);
  }

  return customer;
}

export async function create(
  input: CreateCustomerInput,
  userId: string,
  ip?: string
) {
  // Auto-sync: accountNumber present → hasAccount = true (immutable)
  const data = input.accountNumber ? { ...input, hasAccount: true } : input;
  const { createdAt: createdAtStr, ...dataWithoutCreatedAt } = data;

  // Uniqueness check
  if (data.accountNumber) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.accountNumber, data.accountNumber));
    if (existing) {
      throw new AppError("Số tài khoản đã tồn tại", 409);
    }
  }

  const [customer] = await db
    .insert(customers)
    .values({
      ...dataWithoutCreatedAt,
      balance: String(dataWithoutCreatedAt.balance),
      createdBy: userId,
      updatedBy: userId,
      createdAt: createdAtStr
        ? (() => { const [y, m, d] = createdAtStr.split("-").map(Number); return new Date(y, m - 1, d); })()
        : new Date(),
    })
    .returning()
    .catch((err) => {
      if (err?.code === "23505" && String(err?.constraint ?? "").includes("account_number")) {
        throw new AppError("Số tài khoản đã tồn tại", 409);
      }
      throw err;
    });

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: "CREATE",
    resource: "customers",
    resourceId: customer.id,
    newData: customer,
    ipAddress: ip,
  });

  return customer;
}

export async function update(
  id: string,
  input: UpdateCustomerInput,
  userId: string,
  canViewAll: boolean,
  ip?: string
) {
  const existing = await getById(id, userId, canViewAll);

  // Auto-sync: accountNumber present → hasAccount = true (immutable)
  const patch = input.accountNumber ? { ...input, hasAccount: true } : input;
  const { createdAt: createdAtStr, ...patchWithoutCreatedAt } = patch;

  // Uniqueness check (exclude current record)
  if (patch.accountNumber) {
    const [dup] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.accountNumber, patch.accountNumber),
          sql`${customers.id} != ${id}`
        )
      );
    if (dup) {
      throw new AppError("Số tài khoản đã tồn tại", 409);
    }
  }

  const [updated] = await db
    .update(customers)
    .set({
      ...patchWithoutCreatedAt,
      balance: patchWithoutCreatedAt.balance !== undefined ? String(patchWithoutCreatedAt.balance) : undefined,
      updatedBy: userId,
      updatedAt: new Date(),
      createdAt: createdAtStr
        ? (() => { const [y, m, d] = createdAtStr.split("-").map(Number); return new Date(y, m - 1, d); })()
        : undefined,
    })
    .where(eq(customers.id, id))
    .returning()
    .catch((err) => {
      if (err?.code === "23505" && String(err?.constraint ?? "").includes("account_number")) {
        throw new AppError("Số tài khoản đã tồn tại", 409);
      }
      throw err;
    });

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: "UPDATE",
    resource: "customers",
    resourceId: id,
    oldData: existing,
    newData: updated,
    ipAddress: ip,
  });

  return updated;
}

export async function remove(
  id: string,
  userId: string,
  canViewAll: boolean,
  ip?: string
) {
  const existing = await getById(id, userId, canViewAll);

  await db.delete(customers).where(eq(customers.id, id));

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: "DELETE",
    resource: "customers",
    resourceId: id,
    oldData: existing,
    ipAddress: ip,
  });
}

export async function getStats(userId: string, canViewAll: boolean) {
  const conditions = canViewAll
    ? undefined
    : eq(customers.consultantId, userId);

  const [stats] = await db
    .select({
      totalCustomers: count(),
      withAccount: count(sql`CASE WHEN ${customers.hasAccount} THEN 1 END`),
      withAgribankPlus: count(
        sql`CASE WHEN ${customers.hasAgribankPlus} THEN 1 END`
      ),
      useMisa: count(
        sql`CASE WHEN ${customers.software} = 'MISA' THEN 1 END`
      ),
      useVnpay: count(
        sql`CASE WHEN ${customers.software} = 'VNPAY' THEN 1 END`
      ),
      noSoftware: count(
        sql`CASE WHEN ${customers.software} = 'NO' THEN 1 END`
      ),
      otherSoftware: count(
        sql`CASE WHEN ${customers.software} = 'OTHER' THEN 1 END`
      ),
      totalBalance: sql<string>`COALESCE(SUM(${customers.balance}), 0)`,
      group1: count(sql`CASE WHEN ${customers.customerGroup} = 1 THEN 1 END`),
      group2: count(sql`CASE WHEN ${customers.customerGroup} = 2 THEN 1 END`),
      group3: count(sql`CASE WHEN ${customers.customerGroup} = 3 THEN 1 END`),
      group4: count(sql`CASE WHEN ${customers.customerGroup} = 4 THEN 1 END`),
    })
    .from(customers)
    .where(conditions);

  return stats;
}

async function importAgribankPlusFromFile(
  buffer: Buffer,
  filename: string,
  userId: string,
  ip?: string
): Promise<CustomerImportResult> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext !== "xls") {
    throw new AppError("Import Agribank Plus chỉ chấp nhận file .xls", 400);
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new AppError("File Excel không có sheet nào", 400);

  const worksheet = workbook.Sheets[firstSheetName];
  const table = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];

  const headerRow = table[0] ?? [];
  const headerIndexes = new Map<string, number>();
  headerRow.forEach((value, index) => {
    const header = normalizeHeaderKey(getCellText(value));
    if (header) headerIndexes.set(header, index);
  });

  const requiredHeaders = ["custseq", "mblno1"];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length > 0) {
    throw new AppError(`File Agribank Plus thiếu cột bắt buộc: ${missingHeaders.join(", ")}`, 400);
  }

  const results: CustomerImportResult = {
    success: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    skippedRows: [],
  };
  const validRows: { rowNumber: number; customerCode: string; phone: string }[] = [];
  const customerCodeIndex = headerIndexes.get("custseq")!;
  const phoneIndex = headerIndexes.get("mblno1")!;

  table.slice(1).forEach((row, index) => {
    if (!row.some((value) => normalizeText(getCellText(value)))) return;

    const rowNumber = index + 2;
    const customerCode = normalizeText(getCellText(row[customerCodeIndex]));
    const phone = normalizeText(getCellText(row[phoneIndex]));

    if (!customerCode) {
      results.errors.push({ row: rowNumber, message: "Thiếu custseq" });
    }
    if (!phone) {
      results.errors.push({ row: rowNumber, message: "Thiếu mblno1" });
    }
    if (!customerCode || !phone) return;

    validRows.push({ rowNumber, customerCode, phone });
  });

  const uniqueCodes = [...new Set(validRows.map((row) => row.customerCode))];
  const customerIdsByCode = new Map<string, string[]>();

  if (uniqueCodes.length > 0) {
    const matchedCustomers = await db
      .select({ id: customers.id, customerCode: customers.customerCode })
      .from(customers)
      .where(inArray(customers.customerCode, uniqueCodes));

    for (const customer of matchedCustomers) {
      if (!customer.customerCode) continue;
      const ids = customerIdsByCode.get(customer.customerCode) ?? [];
      ids.push(customer.id);
      customerIdsByCode.set(customer.customerCode, ids);
    }
  }

  const updates: { ids: string[]; phone: string }[] = [];
  for (const row of validRows) {
    const ids = customerIdsByCode.get(row.customerCode) ?? [];
    if (ids.length === 0) {
      results.skipped += 1;
      results.skippedRows.push({
        row: row.rowNumber,
        message: `Không tìm thấy khách hàng có mã "${row.customerCode}"`,
      });
      continue;
    }
    updates.push({ ids, phone: row.phone });
  }

  await db.transaction(async (tx) => {
    for (const update of updates) {
      const updatedRows = await tx
        .update(customers)
        .set({
          phone: update.phone,
          hasAgribankPlus: true,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(inArray(customers.id, update.ids))
        .returning({ id: customers.id });
      results.updated += updatedRows.length;
    }
  });

  await db.insert(auditLogs).values({
    userId,
    action: "IMPORT",
    resource: "customers",
    newData: {
      filename,
      type: "agribankPlus",
      success: results.success,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.length,
    },
    ipAddress: ip,
  });

  return results;
}

export async function importFromFile(
  buffer: Buffer,
  filename: string,
  userId: string,
  ip?: string,
  importType: CustomerImportType = "standard"
): Promise<CustomerImportResult> {
  if (importType === "agribankPlus") {
    return importAgribankPlusFromFile(buffer, filename, userId, ip);
  }

  type ImportedRow = { rowNumber: number; data: Record<string, any>; rawData: Record<string, unknown> };
  type InsertItem = { data: CreateCustomerInput; accountOpenedAt?: Date };
  type UpsertItem = { id: string; payload: CreateCustomerInput; accountOpenedAt?: Date };
  const ext = filename.toLowerCase().split(".").pop();
  let rows: ImportedRow[];

  if (importType === "mist81" && ext !== "xls") {
    throw new AppError("Import MIST81 chỉ chấp nhận file .xls", 400);
  }

  if (importType === "standard" && ext === "csv") {
    const parsedRows: Record<string, any>[] = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
    rows = parsedRows.map((row, index) => ({ rowNumber: index + 2, data: row, rawData: row as Record<string, unknown> }));
  } else if (importType === "mist81") {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new AppError("File Excel không có sheet nào", 400);

    const worksheet = workbook.Sheets[firstSheetName];
    const table = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }) as unknown[][];
    const headerRow = table[0] ?? [];
    const mist81Headers = [
      "Customer_No",
      "Customer_Name",
      "Account_Number",
      "Curent_Balance",
      "Opening_Date",
      "Address",
    ];
    const mist81HeaderByKey = new Map(
      mist81Headers.map((header) => [normalizeHeaderKey(header), header])
    );
    const headers = headerRow.map((value) => {
      const rawHeader = getCellText(value);
      const normalizedHeader = normalizeHeaderKey(rawHeader);
      return (normalizedHeader && mist81HeaderByKey.get(normalizedHeader)) || rawHeader;
    });
    const requiredHeaders = ["Customer_Name", "Account_Number", "Curent_Balance", "Opening_Date", "Address"];
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new AppError(`File MIST81 thiếu cột bắt buộc: ${missingHeaders.join(", ")}`, 400);
    }

    rows = table
      .slice(1)
      .map((row, index) => {
        const obj: Record<string, any> = {};
        const rawValues: Record<string, unknown> = {};
        headers.forEach((header, colIndex) => {
          if (header) {
            obj[header] = getCellText(row[colIndex]);
            rawValues[header] = row[colIndex];
          }
        });
        return { rowNumber: index + 2, data: obj, rawData: rawValues };
      })
      .filter(({ rawData }) => Object.values(rawData).some((value) => getCellText(value).length > 0));
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new AppError("File Excel không có sheet nào", 400);
    const resolveFormula = createExcelFormulaResolver(workbook, worksheet);

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = getCellText(cell.value, resolveFormula);
    });

    rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, any> = {};
      const rawValues: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          obj[header] = getCellText(cell.value, resolveFormula);
          rawValues[header] = cell.value;
        }
      });
      rows.push({ rowNumber, data: obj, rawData: rawValues });
    });
  }

  // Column mapping (Vietnamese headers -> field names)
  const columnMap: Record<string, string> = {
    "Tên HKD": "businessName",
    "Tên hộ kinh doanh": "businessName",
    "businessName": "businessName",
    "Customer_Name": "customerName",
    "Chủ hộ": "ownerName",
    "ownerName": "ownerName",
    "Mã KH": "customerCode",
    "Mã khách hàng": "customerCode",
    "customerCode": "customerCode",
    "Customer_No": "customerCode",
    "Số ĐKKD": "registrationNumber",
    "registrationNumber": "registrationNumber",
    "SĐT": "phone",
    "Số điện thoại": "phone",
    "phone": "phone",
    "Địa chỉ": "address",
    "address": "address",
    "Tài khoản": "hasAccount",
    "hasAccount": "hasAccount",
    "Số dư": "balance",
    "balance": "balance",
    "Agribank Plus": "hasAgribankPlus",
    "hasAgribankPlus": "hasAgribankPlus",
    "Phần mềm": "software",
    "software": "software",
    "Nguồn": "leadSource",
    "leadSource": "leadSource",
    "Ghi chú": "notes",
    "notes": "notes",
    "CBTV": "consultantCode",
    "Cán bộ tư vấn": "consultantCode",
    "Mã CBTV": "consultantCode",
    "consultantCode": "consultantCode",
    "Ngày mở TK": "accountOpenedAt",
    "accountOpenedAt": "accountOpenedAt",
    "Opening_Date": "accountOpenedAt",
    "Số TK": "accountNumber",
    "Số tài khoản": "accountNumber",
    "accountNumber": "accountNumber",
    "Account_Number": "accountNumber",
    "Nhóm": "customerGroup",
    "Nhóm KH": "customerGroup",
    "customerGroup": "customerGroup",
    "Curent_Balance": "balance",
    "Current_Balance": "balance",
    "Address": "address",
  };

  const normalizeText = (value: unknown): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const parseBoolean = (value: unknown): boolean | undefined => {
    const normalized = normalizeText(value);
    if (!normalized) return undefined;
    const booleanTrue = ["true", "1", "có", "co", "yes", "x"];
    return booleanTrue.includes(normalized.toLowerCase());
  };

  const parseBalance = (value: unknown): string | undefined => {
    const normalized = normalizeText(value);
    if (!normalized) return undefined;
    return normalized.replace(/[,.\s]/g, "") || "0";
  };

  const parseSoftware = (value: unknown): CreateCustomerInput["software"] | undefined => {
    const normalized = normalizeText(value);
    if (!normalized) return undefined;
    const upper = normalized.toUpperCase();
    const validSoftware: CreateCustomerInput["software"][] = ["MISA", "VNPAY", "NO", "OTHER"];
    return validSoftware.includes(upper as CreateCustomerInput["software"])
      ? (upper as CreateCustomerInput["software"])
      : "NO";
  };

  const parseCustomerGroup = (value: unknown): number | undefined => {
    const normalized = normalizeText(value);
    if (!normalized) return undefined;
    const num = parseInt(normalized, 10);
    return num >= 1 && num <= 4 ? num : undefined;
  };

  const results: CustomerImportResult = {
    success: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    skippedRows: [],
  };
  const toInsert: InsertItem[] = [];
  const toUpdate: UpsertItem[] = [];
  const seenAccountNumbers = new Map<string, number>();

  // Pre-fetch DB matches for accountNumbers – one batch query instead of per-row queries
  const allMappedAccountNumbers: string[] = [];
  for (const { data: raw } of rows) {
    for (const [key, value] of Object.entries(raw)) {
      if (columnMap[key.trim()] === "accountNumber") {
        const accNum = normalizeText(value);
        if (accNum) allMappedAccountNumbers.push(accNum);
        break;
      }
    }
  }
  const uniqueAccountNumbers = [...new Set(allMappedAccountNumbers)];
  const dbAccountNumberMap = new Map<string, string>(); // accountNumber -> customer.id
  if (uniqueAccountNumbers.length > 0) {
    const existingAccounts = await db
      .select({ id: customers.id, accountNumber: customers.accountNumber })
      .from(customers)
      .where(inArray(customers.accountNumber, uniqueAccountNumbers));
    for (const acc of existingAccounts) {
      if (acc.accountNumber) dbAccountNumberMap.set(acc.accountNumber, acc.id);
    }
  }

  for (const { rowNumber, data: raw, rawData } of rows) {
    const mapped: Record<string, any> = {};

    for (const [key, value] of Object.entries(raw)) {
      const field = columnMap[key.trim()];
      if (field) mapped[field] = value;
    }

    const customerName = normalizeText(mapped.customerName);
    if (customerName) {
      mapped.businessName = customerName;
      mapped.ownerName = customerName;
    }

    // Extract raw date value for parsing (before getCellText conversion)
    const dateColumnName = Object.keys(raw).find(key => columnMap[key.trim()] === "accountOpenedAt");
    const rawDateValue = dateColumnName ? rawData[dateColumnName] : undefined;
    const accountOpenedAt = parseDate(rawDateValue);
    if (importType === "mist81" && !accountOpenedAt) {
      results.errors.push({
        row: rowNumber,
        message: "Opening_Date không hợp lệ",
      });
      continue;
    }

    const registrationNumber = normalizeText(mapped.registrationNumber) ?? null;

    const accountNumber = normalizeText(mapped.accountNumber) ?? null;
    if (!accountNumber) {
      results.errors.push({
        row: rowNumber,
        message: "Thiếu số tài khoản",
      });
      continue;
    }
    if (accountNumber) {
      const firstSeenRow = seenAccountNumbers.get(accountNumber);
      if (firstSeenRow) {
        results.errors.push({
          row: rowNumber,
          message: `Số TK "${accountNumber}" bị trùng trong file (đã xuất hiện ở dòng ${firstSeenRow})`,
        });
        continue;
      }
      seenAccountNumbers.set(accountNumber, rowNumber);
    }

    const hasAccount = parseBoolean(mapped.hasAccount);
    const hasAgribankPlus = parseBoolean(mapped.hasAgribankPlus);
    const balance = parseBalance(mapped.balance);
    const software = parseSoftware(mapped.software);

    let existingCustomer:
      | {
          id: string;
          businessName: string;
          ownerName: string;
          customerCode: string | null;
          registrationNumber: string | null;
          phone: string | null;
          address: string | null;
          hasAccount: boolean;
          accountNumber: string | null;
          balance: string | null;
          hasAgribankPlus: boolean;
          software: string;
          customerGroup: number;
          consultantId: string | null;
          leadSource: string | null;
          notes: string | null;
        }
      | null = null;

    // accountNumber match: only match key for upsert (registrationNumber can be duplicated)
    if (accountNumber) {
      const existingId = dbAccountNumberMap.get(accountNumber);
      if (existingId) {
        const [accCustomer] = await db
          .select({
            id: customers.id,
            businessName: customers.businessName,
            ownerName: customers.ownerName,
            customerCode: customers.customerCode,
            registrationNumber: customers.registrationNumber,
            phone: customers.phone,
            address: customers.address,
            hasAccount: customers.hasAccount,
            accountNumber: customers.accountNumber,
            balance: customers.balance,
            hasAgribankPlus: customers.hasAgribankPlus,
            software: customers.software,
            customerGroup: customers.customerGroup,
            consultantId: customers.consultantId,
            leadSource: customers.leadSource,
            notes: customers.notes,
          })
          .from(customers)
          .where(eq(customers.id, existingId));
        existingCustomer = accCustomer ?? null;
      }
    }

    // Keep existing consultant logic: look up by employee code
    const consultantCode = normalizeText(mapped.consultantCode);
    let consultantId: string | null | undefined = undefined;
    if (consultantCode !== undefined) {
      const [consultant] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeCode, consultantCode));
      consultantId = consultant ? consultant.id : null;
    }

    const payload = {
      businessName: normalizeText(mapped.businessName) ?? existingCustomer?.businessName,
      ownerName: normalizeText(mapped.ownerName) ?? existingCustomer?.ownerName,
      customerCode: normalizeText(mapped.customerCode) ?? existingCustomer?.customerCode ?? null,
      registrationNumber: registrationNumber ?? existingCustomer?.registrationNumber ?? null,
      phone: normalizeText(mapped.phone) ?? existingCustomer?.phone ?? null,
      address: normalizeText(mapped.address) ?? existingCustomer?.address ?? null,
      hasAccount: hasAccount ?? existingCustomer?.hasAccount ?? false,
      accountNumber: accountNumber ?? existingCustomer?.accountNumber ?? null,
      balance: balance ?? String(existingCustomer?.balance ?? "0"),
      hasAgribankPlus: hasAgribankPlus ?? existingCustomer?.hasAgribankPlus ?? false,
      software: software ?? existingCustomer?.software ?? "NO",
      customerGroup: parseCustomerGroup(mapped.customerGroup) ?? existingCustomer?.customerGroup ?? 1,
      consultantId: consultantId !== undefined ? consultantId : existingCustomer?.consultantId ?? null,
      leadSource: normalizeText(mapped.leadSource) ?? existingCustomer?.leadSource ?? null,
      notes: normalizeText(mapped.notes) ?? existingCustomer?.notes ?? null,
    };

    // Auto-sync: if accountNumber is present, force hasAccount = true
    if (payload.accountNumber) {
      payload.hasAccount = true;
    }

    const parsed = createCustomerSchema.safeParse(payload);
    if (!parsed.success) {
      results.errors.push({
        row: rowNumber,
        message: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ",
      });
      continue;
    }

    if (existingCustomer) {
      toUpdate.push({ id: existingCustomer.id, payload: parsed.data, accountOpenedAt });
    } else {
      toInsert.push({ data: parsed.data, accountOpenedAt });
    }
  }

  if (results.errors.length > 0) {
    await db.insert(auditLogs).values({
      userId,
      action: "IMPORT",
      resource: "customers",
      newData: { filename, success: 0, updated: 0, skipped: 0, errors: results.errors.length },
      ipAddress: ip,
    });

    return results;
  }

  await db.transaction(async (tx) => {
    for (const item of toInsert) {
      const { createdAt: _ca, ...insertData } = item.data;
      await tx.insert(customers).values({
        ...insertData,
        balance: String(insertData.balance),
        createdBy: userId,
        updatedBy: userId,
        createdAt: item.accountOpenedAt ?? new Date(),
      });
    }

    for (const item of toUpdate) {
      const { createdAt: _ca, ...updatePayload } = item.payload;
      await tx
        .update(customers)
        .set({
          ...updatePayload,
          balance: String(updatePayload.balance),
          updatedBy: userId,
          updatedAt: new Date(),
          ...(item.accountOpenedAt && { createdAt: item.accountOpenedAt }),
        })
        .where(eq(customers.id, item.id));
    }
  });

  results.success = toInsert.length;
  results.updated = toUpdate.length;

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: "IMPORT",
    resource: "customers",
    newData: { filename, success: results.success, updated: results.updated, skipped: 0, errors: 0 },
    ipAddress: ip,
  });

  return results;
}

export async function exportToExcel(userId: string, canViewAll: boolean): Promise<Buffer> {
  const conditions = canViewAll ? undefined : eq(customers.consultantId, userId);

  const data = await db
    .select({
      businessName: customers.businessName,
      ownerName: customers.ownerName,
      customerCode: customers.customerCode,
      registrationNumber: customers.registrationNumber,
      phone: customers.phone,
      address: customers.address,
      hasAccount: customers.hasAccount,
      accountNumber: customers.accountNumber,
      balance: customers.balance,
      hasAgribankPlus: customers.hasAgribankPlus,
      software: customers.software,
      customerGroup: customers.customerGroup,
      consultantName: users.fullName,
      leadSource: customers.leadSource,
      notes: customers.notes,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .where(conditions)
    .orderBy(customers.businessName);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Khách hàng");

  worksheet.columns = [
    { header: "Tên HKD", key: "businessName", width: 30 },
    { header: "Chủ hộ", key: "ownerName", width: 20 },
    { header: "Mã KH", key: "customerCode", width: 15 },
    { header: "Số ĐKKD", key: "registrationNumber", width: 15 },
    { header: "SĐT", key: "phone", width: 15 },
    { header: "Địa chỉ", key: "address", width: 30 },
    { header: "Tài khoản", key: "hasAccount", width: 10 },
    { header: "Số TK", key: "accountNumber", width: 20 },
    { header: "Số dư", key: "balance", width: 15 },
    { header: "Agribank Plus", key: "hasAgribankPlus", width: 12 },
    { header: "Phần mềm", key: "software", width: 10 },
    { header: "Nhóm", key: "customerGroup", width: 10 },
    { header: "CBTV", key: "consultantName", width: 20 },
    { header: "Nguồn", key: "leadSource", width: 15 },
    { header: "Ghi chú", key: "notes", width: 30 },
    { header: "Ngày mở TK", key: "createdAt", width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE6EA" } };

  for (const row of data) {
    worksheet.addRow({
      ...row,
      hasAccount: row.hasAccount ? "Có" : "Không",
      accountNumber: row.accountNumber || "",
      hasAgribankPlus: row.hasAgribankPlus ? "Có" : "Không",
      customerGroup: row.customerGroup,
      balance: Number(row.balance),
      createdAt: formatDate(row.createdAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportToCsv(userId: string, canViewAll: boolean): Promise<string> {
  const conditions = canViewAll ? undefined : eq(customers.consultantId, userId);

  const data = await db
    .select({
      businessName: customers.businessName,
      ownerName: customers.ownerName,
      customerCode: customers.customerCode,
      registrationNumber: customers.registrationNumber,
      phone: customers.phone,
      address: customers.address,
      hasAccount: customers.hasAccount,
      accountNumber: customers.accountNumber,
      balance: customers.balance,
      hasAgribankPlus: customers.hasAgribankPlus,
      software: customers.software,
      customerGroup: customers.customerGroup,
      consultantName: users.fullName,
      leadSource: customers.leadSource,
      notes: customers.notes,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .where(conditions)
    .orderBy(customers.businessName);

  const rows = data.map((row) => ({
    "Tên HKD": row.businessName,
    "Chủ hộ": row.ownerName,
    "Mã KH": row.customerCode || "",
    "Số ĐKKD": row.registrationNumber || "",
    "SĐT": row.phone || "",
    "Địa chỉ": row.address || "",
    "Tài khoản": row.hasAccount ? "Có" : "Không",
    "Số TK": row.accountNumber || "",
    "Số dư": row.balance,
    "Agribank Plus": row.hasAgribankPlus ? "Có" : "Không",
    "Phần mềm": row.software,
    "Nhóm": row.customerGroup,
    "CBTV": row.consultantName || "",
    "Nguồn": row.leadSource || "",
    "Ghi chú": row.notes || "",
    "Ngày mở TK": formatDate(row.createdAt),
  }));

  return stringify(rows, { header: true, bom: true });
}

export async function listPool(query: PoolQuery) {
  const conditions = [isNull(customers.consultantId)];

  if (query.search) {
    conditions.push(
      or(
        ilike(customers.businessName, `%${query.search}%`),
        ilike(customers.ownerName, `%${query.search}%`),
        ilike(customers.customerCode, `%${query.search}%`),
        ilike(customers.phone, `%${query.search}%`),
        ilike(customers.registrationNumber, `%${query.search}%`),
        ilike(customers.accountNumber, `%${query.search}%`)
      )!
    );
  }

  if (query.software) {
    conditions.push(eq(customers.software, query.software));
  }

  if (query.hasAccount !== undefined) {
    conditions.push(eq(customers.hasAccount, query.hasAccount));
  }

  if (query.hasAgribankPlus !== undefined) {
    conditions.push(eq(customers.hasAgribankPlus, query.hasAgribankPlus));
  }

  if (query.customerGroup !== undefined) {
    conditions.push(eq(customers.customerGroup, query.customerGroup));
  }

  const whereClause = and(...conditions);

  const sortColumn = {
    businessName: customers.businessName,
    ownerName: customers.ownerName,
    createdAt: customers.createdAt,
    balance: customers.balance,
  }[query.sortBy];

  const orderFn = query.sortOrder === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.limit;

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: customers.id,
        businessName: customers.businessName,
        ownerName: customers.ownerName,
        customerCode: customers.customerCode,
        registrationNumber: customers.registrationNumber,
        phone: customers.phone,
        address: customers.address,
        hasAccount: customers.hasAccount,
        accountNumber: customers.accountNumber,
        balance: customers.balance,
        hasAgribankPlus: customers.hasAgribankPlus,
        software: customers.software,
        consultantId: customers.consultantId,
        customerGroup: customers.customerGroup,
        leadSource: customers.leadSource,
        notes: customers.notes,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(customers)
      .where(whereClause),
  ]);

  return { data, total };
}

export async function claimCustomers(customerIds: string[], userId: string, ip?: string) {
  const result = await db
    .update(customers)
    .set({
      consultantId: userId,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(customers.id, customerIds),
        isNull(customers.consultantId)
      )
    )
    .returning({ id: customers.id });

  const claimed = result.length;
  const alreadyClaimed = customerIds.length - claimed;

  await db.insert(auditLogs).values({
    userId,
    action: "CLAIM",
    resource: "customers",
    newData: { customerIds: result.map(r => r.id), claimedCount: claimed },
    ipAddress: ip,
  });

  return { claimed, alreadyClaimed };
}

export async function unclaimCustomers(customerIds: string[], userId: string, ip?: string) {
  const result = await db
    .update(customers)
    .set({
      consultantId: null,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(inArray(customers.id, customerIds))
    .returning({ id: customers.id });

  await db.insert(auditLogs).values({
    userId,
    action: "UNCLAIM",
    resource: "customers",
    newData: { customerIds: result.map(r => r.id), unclaimedCount: result.length },
    ipAddress: ip,
  });

  return { unclaimed: result.length };
}
