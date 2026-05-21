import ExcelJS from "exceljs";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../config/database.js";
import { customers } from "../../db/schema/customers.js";
import { users } from "../../db/schema/users.js";
import { branches, departments } from "../../db/schema/organization.js";
import { AppError } from "../../middleware/errorHandler.js";

export interface ReportStats {
  total: number;
  withAccount: number;
  withAgribankPlus: number;
  useMisa: number;
  useVnpay: number;
  group1: number;
  group2: number;
  group3: number;
  group4: number;
}

export interface NewCustomersReport {
  stats: ReportStats;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  departmentId?: string;
  customerGroup?: number;
}

function parseDate(value: string, isEndOfDay: boolean): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD", 400);
  }

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new AppError("Ngày không hợp lệ", 400);
  }

  const date = isEndOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new AppError("Ngày không hợp lệ", 400);
  }

  return date;
}

function resolveDateRange(dateFrom?: string, dateTo?: string) {
  const fromDate = dateFrom ? parseDate(dateFrom, false) : undefined;
  const toDate = dateTo ? parseDate(dateTo, true) : undefined;

  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError("Từ ngày không được lớn hơn đến ngày", 400);
  }

  return { fromDate, toDate };
}

function formatVietnamDate(date: Date | null | undefined): string {
  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export async function getNewCustomersReport(filters: ReportFilters = {}): Promise<NewCustomersReport> {
  const { fromDate, toDate } = resolveDateRange(filters.dateFrom, filters.dateTo);
  const conditions = [];

  if (fromDate) {
    conditions.push(gte(customers.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(customers.createdAt, toDate));
  }
  if (filters.branchId) {
    conditions.push(eq(users.branchId, filters.branchId));
  }
  if (filters.departmentId) {
    conditions.push(eq(users.departmentId, filters.departmentId));
  }
  if (filters.customerGroup !== undefined) {
    conditions.push(eq(customers.customerGroup, filters.customerGroup));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [statsRow] = await db
    .select({
      total: count(),
      withAccount: count(sql`CASE WHEN ${customers.hasAccount} THEN 1 END`),
      withAgribankPlus: count(sql`CASE WHEN ${customers.hasAgribankPlus} THEN 1 END`),
      useMisa: count(sql`CASE WHEN ${customers.software} = 'MISA' THEN 1 END`),
      useVnpay: count(sql`CASE WHEN ${customers.software} = 'VNPAY' THEN 1 END`),
      group1: count(sql`CASE WHEN ${customers.customerGroup} = 1 THEN 1 END`),
      group2: count(sql`CASE WHEN ${customers.customerGroup} = 2 THEN 1 END`),
      group3: count(sql`CASE WHEN ${customers.customerGroup} = 3 THEN 1 END`),
      group4: count(sql`CASE WHEN ${customers.customerGroup} = 4 THEN 1 END`),
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .where(whereClause);

  const stats: ReportStats = {
    total: Number(statsRow?.total || 0),
    withAccount: Number(statsRow?.withAccount || 0),
    withAgribankPlus: Number(statsRow?.withAgribankPlus || 0),
    useMisa: Number(statsRow?.useMisa || 0),
    useVnpay: Number(statsRow?.useVnpay || 0),
    group1: Number(statsRow?.group1 || 0),
    group2: Number(statsRow?.group2 || 0),
    group3: Number(statsRow?.group3 || 0),
    group4: Number(statsRow?.group4 || 0),
  };

  return { stats };
}

export async function exportNewCustomersExcel(filters: ReportFilters = {}): Promise<Buffer> {
  const report = await getNewCustomersReport(filters);
  const { fromDate, toDate } = resolveDateRange(filters.dateFrom, filters.dateTo);
  const conditions = [];

  if (fromDate) {
    conditions.push(gte(customers.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(customers.createdAt, toDate));
  }
  if (filters.branchId) {
    conditions.push(eq(users.branchId, filters.branchId));
  }
  if (filters.departmentId) {
    conditions.push(eq(users.departmentId, filters.departmentId));
  }
  if (filters.customerGroup !== undefined) {
    conditions.push(eq(customers.customerGroup, filters.customerGroup));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      businessName: customers.businessName,
      ownerName: customers.ownerName,
      registrationNumber: customers.registrationNumber,
      phone: customers.phone,
      address: customers.address,
      hasAccount: customers.hasAccount,
      accountNumber: customers.accountNumber,
      hasAgribankPlus: customers.hasAgribankPlus,
      software: customers.software,
      customerGroup: customers.customerGroup,
      consultantName: users.fullName,
      branchName: branches.name,
      departmentName: departments.name,
      balance: customers.balance,
      leadSource: customers.leadSource,
      notes: customers.notes,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(whereClause)
    .orderBy(desc(customers.createdAt));

  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Tong hop");
  summarySheet.columns = [
    { header: "Chỉ tiêu", key: "metric", width: 28 },
    { header: "Giá trị", key: "value", width: 18 },
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDE6EA" },
  };

  summarySheet.addRows([
    { metric: "Tổng KH mới", value: report.stats.total },
    { metric: "Có tài khoản", value: report.stats.withAccount },
    { metric: "Agribank Plus", value: report.stats.withAgribankPlus },
    { metric: "Dùng MISA", value: report.stats.useMisa },
    { metric: "Dùng VNPAY", value: report.stats.useVnpay },
    { metric: "Nhóm 1", value: report.stats.group1 },
    { metric: "Nhóm 2", value: report.stats.group2 },
    { metric: "Nhóm 3", value: report.stats.group3 },
    { metric: "Nhóm 4", value: report.stats.group4 },
  ]);

  const detailSheet = workbook.addWorksheet("Danh sach KH moi");
  detailSheet.columns = [
    { header: "Tên HKD", key: "businessName", width: 30 },
    { header: "Chủ hộ", key: "ownerName", width: 24 },
    { header: "Số ĐKKD", key: "registrationNumber", width: 18 },
    { header: "SĐT", key: "phone", width: 15 },
    { header: "Địa chỉ", key: "address", width: 36 },
    { header: "Có TK", key: "hasAccount", width: 10 },
    { header: "Số TK", key: "accountNumber", width: 20 },
    { header: "Số dư", key: "balance", width: 16 },
    { header: "AG+", key: "hasAgribankPlus", width: 10 },
    { header: "Phần mềm", key: "software", width: 12 },
    { header: "Nhóm", key: "customerGroup", width: 10 },
    { header: "CBTV", key: "consultantName", width: 24 },
    { header: "Chi nhánh", key: "branchName", width: 24 },
    { header: "Phòng ban", key: "departmentName", width: 24 },
    { header: "Nguồn lead", key: "leadSource", width: 20 },
    { header: "Ghi chú", key: "notes", width: 36 },
    { header: "Ngày tạo", key: "createdAt", width: 16 },
    { header: "Ngày cập nhật cuối", key: "updatedAt", width: 22 },
  ];

  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDE6EA" },
  };

  for (const row of rows) {
    detailSheet.addRow({
      businessName: row.businessName,
      ownerName: row.ownerName,
      registrationNumber: row.registrationNumber || "",
      phone: row.phone || "",
      address: row.address || "",
      hasAccount: row.hasAccount ? "Có" : "Không",
      accountNumber: row.accountNumber || "",
      balance: row.balance || "0",
      hasAgribankPlus: row.hasAgribankPlus ? "Có" : "Không",
      software: row.software,
      customerGroup: row.customerGroup,
      consultantName: row.consultantName || "",
      branchName: row.branchName || "",
      departmentName: row.departmentName || "",
      leadSource: row.leadSource || "",
      notes: row.notes || "",
      createdAt: formatVietnamDate(row.createdAt),
      updatedAt: formatVietnamDate(row.updatedAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface DepartmentBreakdown {
  id: string;
  name: string;
  stats: ReportStats;
}

export interface BranchBreakdown {
  id: string;
  code: string;
  name: string;
  totals: ReportStats;
  departments: DepartmentBreakdown[];
}

export interface BranchDepartmentBreakdown {
  branches: BranchBreakdown[];
  grandTotal: ReportStats;
}

function emptyStats(): ReportStats {
  return {
    total: 0,
    withAccount: 0,
    withAgribankPlus: 0,
    useMisa: 0,
    useVnpay: 0,
    group1: 0,
    group2: 0,
    group3: 0,
    group4: 0,
  };
}

function addStats(a: ReportStats, b: ReportStats): ReportStats {
  return {
    total: a.total + b.total,
    withAccount: a.withAccount + b.withAccount,
    withAgribankPlus: a.withAgribankPlus + b.withAgribankPlus,
    useMisa: a.useMisa + b.useMisa,
    useVnpay: a.useVnpay + b.useVnpay,
    group1: a.group1 + b.group1,
    group2: a.group2 + b.group2,
    group3: a.group3 + b.group3,
    group4: a.group4 + b.group4,
  };
}

export async function getBranchDepartmentBreakdown(
  dateFrom?: string,
  dateTo?: string
): Promise<BranchDepartmentBreakdown> {
  const { fromDate, toDate } = resolveDateRange(dateFrom, dateTo);
  const conditions = [];
  if (fromDate) conditions.push(gte(customers.createdAt, fromDate));
  if (toDate) conditions.push(lte(customers.createdAt, toDate));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const aggRows = await db
    .select({
      branchId: users.branchId,
      departmentId: users.departmentId,
      total: count(),
      withAccount: count(sql`CASE WHEN ${customers.hasAccount} THEN 1 END`),
      withAgribankPlus: count(sql`CASE WHEN ${customers.hasAgribankPlus} THEN 1 END`),
      useMisa: count(sql`CASE WHEN ${customers.software} = 'MISA' THEN 1 END`),
      useVnpay: count(sql`CASE WHEN ${customers.software} = 'VNPAY' THEN 1 END`),
      group1: count(sql`CASE WHEN ${customers.customerGroup} = 1 THEN 1 END`),
      group2: count(sql`CASE WHEN ${customers.customerGroup} = 2 THEN 1 END`),
      group3: count(sql`CASE WHEN ${customers.customerGroup} = 3 THEN 1 END`),
      group4: count(sql`CASE WHEN ${customers.customerGroup} = 4 THEN 1 END`),
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .where(whereClause)
    .groupBy(users.branchId, users.departmentId);

  const statsByKey = new Map<string, ReportStats>();
  for (const row of aggRows) {
    if (!row.branchId || !row.departmentId) continue;
    const key = `${row.branchId}::${row.departmentId}`;
    statsByKey.set(key, {
      total: Number(row.total || 0),
      withAccount: Number(row.withAccount || 0),
      withAgribankPlus: Number(row.withAgribankPlus || 0),
      useMisa: Number(row.useMisa || 0),
      useVnpay: Number(row.useVnpay || 0),
      group1: Number(row.group1 || 0),
      group2: Number(row.group2 || 0),
      group3: Number(row.group3 || 0),
      group4: Number(row.group4 || 0),
    });
  }

  const branchRows = await db
    .select({ id: branches.id, code: branches.code, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.code);

  const departmentRows = await db
    .select({ id: departments.id, name: departments.name, branchId: departments.branchId })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(departments.name);

  const depsByBranch = new Map<string, { id: string; name: string }[]>();
  for (const d of departmentRows) {
    if (!depsByBranch.has(d.branchId)) depsByBranch.set(d.branchId, []);
    depsByBranch.get(d.branchId)!.push({ id: d.id, name: d.name });
  }

  const result: BranchBreakdown[] = [];
  let grandTotal = emptyStats();

  for (const b of branchRows) {
    const deps = depsByBranch.get(b.id) ?? [];
    const departmentsOut: DepartmentBreakdown[] = [];
    let branchTotals = emptyStats();
    for (const d of deps) {
      const stats = statsByKey.get(`${b.id}::${d.id}`) ?? emptyStats();
      departmentsOut.push({ id: d.id, name: d.name, stats });
      branchTotals = addStats(branchTotals, stats);
    }
    result.push({
      id: b.id,
      code: b.code,
      name: b.name,
      totals: branchTotals,
      departments: departmentsOut,
    });
    grandTotal = addStats(grandTotal, branchTotals);
  }

  return { branches: result, grandTotal };
}

export interface BalanceByOrgFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  departmentId?: string;
}

interface ConsultantBalance {
  consultantId: string | null;
  consultantName: string;
  employeeCode: string | null;
  totalBalance: number;
}

interface DepartmentBalance {
  departmentId: string | null;
  departmentName: string;
  totalBalance: number;
  consultants: ConsultantBalance[];
}

interface BranchBalance {
  branchId: string | null;
  branchCode: string;
  branchName: string;
  totalBalance: number;
  departments: DepartmentBalance[];
}

const UNASSIGNED_BRANCH_LABEL = "(Chưa phân chi nhánh)";
const UNASSIGNED_DEPT_LABEL = "(Chưa phân phòng ban)";
const UNASSIGNED_CONSULTANT_LABEL = "(Chưa có CBTV)";

export async function exportBalanceByOrgExcel(
  filters: BalanceByOrgFilters = {}
): Promise<Buffer> {
  const { fromDate, toDate } = resolveDateRange(filters.dateFrom, filters.dateTo);
  const conditions = [];

  if (fromDate) conditions.push(gte(customers.createdAt, fromDate));
  if (toDate) conditions.push(lte(customers.createdAt, toDate));
  if (filters.branchId) conditions.push(eq(users.branchId, filters.branchId));
  if (filters.departmentId) conditions.push(eq(users.departmentId, filters.departmentId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      branchId: users.branchId,
      branchCode: branches.code,
      branchName: branches.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      consultantId: customers.consultantId,
      consultantName: users.fullName,
      employeeCode: users.employeeCode,
      totalBalance: sql<string>`COALESCE(SUM(${customers.balance}), 0)`,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(whereClause)
    .groupBy(
      users.branchId,
      branches.code,
      branches.name,
      users.departmentId,
      departments.name,
      customers.consultantId,
      users.fullName,
      users.employeeCode
    );

  const branchMap = new Map<string, BranchBalance>();

  for (const row of rows) {
    const balance = Number(row.totalBalance ?? 0);
    const branchKey = row.branchId ?? "__unassigned_branch__";
    let branch = branchMap.get(branchKey);
    if (!branch) {
      branch = {
        branchId: row.branchId,
        branchCode: row.branchCode ?? "",
        branchName: row.branchName ?? UNASSIGNED_BRANCH_LABEL,
        totalBalance: 0,
        departments: [],
      };
      branchMap.set(branchKey, branch);
    }

    const deptKey = row.departmentId ?? "__unassigned_dept__";
    let department = branch.departments.find(
      (d) => (d.departmentId ?? "__unassigned_dept__") === deptKey
    );
    if (!department) {
      department = {
        departmentId: row.departmentId,
        departmentName: row.departmentName ?? UNASSIGNED_DEPT_LABEL,
        totalBalance: 0,
        consultants: [],
      };
      branch.departments.push(department);
    }

    department.consultants.push({
      consultantId: row.consultantId,
      consultantName: row.consultantName ?? UNASSIGNED_CONSULTANT_LABEL,
      employeeCode: row.employeeCode,
      totalBalance: balance,
    });
    department.totalBalance += balance;
    branch.totalBalance += balance;
  }

  const branchList = Array.from(branchMap.values());
  for (const branch of branchList) {
    for (const dept of branch.departments) {
      dept.consultants.sort((a, b) => b.totalBalance - a.totalBalance);
    }
    branch.departments.sort((a, b) => b.totalBalance - a.totalBalance);
  }
  branchList.sort((a, b) => b.totalBalance - a.totalBalance);

  const grandTotal = branchList.reduce((sum, b) => sum + b.totalBalance, 0);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bao cao so du");

  sheet.columns = [
    { key: "level", width: 16 },
    { key: "branch", width: 28 },
    { key: "department", width: 28 },
    { key: "consultant", width: 32 },
    { key: "balance", width: 20 },
  ];

  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "BÁO CÁO SỐ DƯ THEO CHI NHÁNH / PHÒNG BAN / CÁN BỘ TƯ VẤN";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:E2");
  const filterParts: string[] = [];
  if (filters.dateFrom) filterParts.push(`Từ ngày: ${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`Đến ngày: ${filters.dateTo}`);
  if (!filters.dateFrom && !filters.dateTo) filterParts.push("Toàn thời gian");
  const filterCell = sheet.getCell("A2");
  filterCell.value = filterParts.join(" | ");
  filterCell.alignment = { horizontal: "center" };
  filterCell.font = { italic: true };

  const headerRow = sheet.addRow({
    level: "Cấp",
    branch: "Chi nhánh",
    department: "Phòng ban",
    consultant: "Cán bộ tư vấn",
    balance: "Tổng số dư",
  });
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDE6EA" },
  };
  headerRow.alignment = { horizontal: "center" };

  const balanceCol = sheet.getColumn(5);
  balanceCol.numFmt = "#,##0";
  balanceCol.alignment = { horizontal: "right" };

  for (const branch of branchList) {
    const branchLabel = branch.branchCode
      ? `${branch.branchCode} - ${branch.branchName}`
      : branch.branchName;
    const branchRow = sheet.addRow({
      level: "Chi nhánh",
      branch: branchLabel,
      department: "",
      consultant: "",
      balance: branch.totalBalance,
    });
    branchRow.font = { bold: true };
    branchRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F1FB" },
    };

    for (const dept of branch.departments) {
      const deptRow = sheet.addRow({
        level: "Phòng ban",
        branch: "",
        department: dept.departmentName,
        consultant: "",
        balance: dept.totalBalance,
      });
      deptRow.font = { bold: true, color: { argb: "FF333333" } };
      deptRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F7FA" },
      };

      for (const consultant of dept.consultants) {
        const consultantLabel = consultant.employeeCode
          ? `${consultant.employeeCode} - ${consultant.consultantName}`
          : consultant.consultantName;
        sheet.addRow({
          level: "CBTV",
          branch: "",
          department: "",
          consultant: consultantLabel,
          balance: consultant.totalBalance,
        });
      }
    }
  }

  const totalRow = sheet.addRow({
    level: "Tổng cộng",
    branch: "",
    department: "",
    consultant: "",
    balance: grandTotal,
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDE6EA" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

interface AccountThresholdStats {
  accountCount: number;
  positiveBalanceCount: number;
  over50kCount: number;
  totalBalance: number;
}

interface AccountThresholdReportRow {
  stt: number | string | null;
  unit: string;
  stats: AccountThresholdStats;
  bold?: boolean;
}

interface AccountThresholdDepartmentBucket {
  key: string;
  unit: string;
  order: number;
  stats: AccountThresholdStats;
}

interface AccountThresholdTopBucket {
  key: string;
  unit: string;
  order: number;
  stats: AccountThresholdStats;
  departments: Map<string, AccountThresholdDepartmentBucket>;
}

const ACCOUNT_THRESHOLD_AMOUNT = 50000;
const HQ_BRANCH_CODE = "6421";
const NAM_HOA_BRANCH_CODE = "6221";
const PGD_BINH_TAY_NAME = "PGD Bình Tây";

const DEPARTMENT_DISPLAY_LABELS = new Map<string, string>([
  ["phong khcn", "P.KHCN"],
  ["phong khdn", "P.KHDN"],
  ["phong ktnq", "P.KTNQ"],
  ["phong khqlrr", "P.KHRR"],
  ["phong khrr", "P.KHRR"],
  ["phong th", "P.TH"],
  ["phong ktgsnb", "P.KTGS"],
  ["phong ktgs", "P.KTGS"],
]);

const DEPARTMENT_DISPLAY_ORDER = new Map<string, number>([
  ["phong khcn", 1],
  ["phong khdn", 2],
  ["phong ktnq", 3],
  ["phong khqlrr", 4],
  ["phong khrr", 4],
  ["phong th", 5],
  ["phong ktgsnb", 6],
  ["phong ktgs", 6],
]);

function normalizeOrgName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function emptyAccountThresholdStats(): AccountThresholdStats {
  return {
    accountCount: 0,
    positiveBalanceCount: 0,
    over50kCount: 0,
    totalBalance: 0,
  };
}

function addAccountThresholdStats(target: AccountThresholdStats, source: AccountThresholdStats) {
  target.accountCount += source.accountCount;
  target.positiveBalanceCount += source.positiveBalanceCount;
  target.over50kCount += source.over50kCount;
  target.totalBalance += source.totalBalance;
}

function buildAccountThresholdStats(balanceValue: string | null): AccountThresholdStats {
  const balance = Number(balanceValue ?? 0);
  return {
    accountCount: 1,
    positiveBalanceCount: balance > 0 ? 1 : 0,
    over50kCount: balance > ACCOUNT_THRESHOLD_AMOUNT ? 1 : 0,
    totalBalance: balance,
  };
}

function formatCompletionRate(stats: AccountThresholdStats): string {
  if (stats.accountCount === 0) return "0%";
  return `${Math.round((stats.over50kCount / stats.accountCount) * 100)}%`;
}

function isHqBranch(branchCode: string | null, branchName: string | null): boolean {
  return branchCode === HQ_BRANCH_CODE || normalizeOrgName(branchName) === "hoi so";
}

function isNamHoaBranch(branchCode: string | null, branchName: string | null): boolean {
  return branchCode === NAM_HOA_BRANCH_CODE || normalizeOrgName(branchName).includes("nam hoa");
}

function isPgdBinhTayDepartment(departmentName: string | null): boolean {
  return normalizeOrgName(departmentName) === normalizeOrgName(PGD_BINH_TAY_NAME);
}

function formatOtherBranchLabel(branchName: string | null): string {
  const label = branchName || UNASSIGNED_BRANCH_LABEL;
  return label.toLocaleUpperCase("vi-VN");
}

function formatDepartmentLabel(departmentName: string | null): string {
  if (!departmentName) return UNASSIGNED_DEPT_LABEL;

  const normalized = normalizeOrgName(departmentName);
  const mapped = DEPARTMENT_DISPLAY_LABELS.get(normalized);
  if (mapped) return mapped;

  if (normalized.startsWith("phong ")) {
    return `P.${departmentName.replace(/^phòng\s+/i, "").toLocaleUpperCase("vi-VN")}`;
  }

  return departmentName.toLocaleUpperCase("vi-VN");
}

function getDepartmentOrder(departmentName: string | null): number {
  return DEPARTMENT_DISPLAY_ORDER.get(normalizeOrgName(departmentName)) ?? 99;
}

function getOrCreateTopBucket(
  buckets: Map<string, AccountThresholdTopBucket>,
  key: string,
  unit: string,
  order: number
): AccountThresholdTopBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      key,
      unit,
      order,
      stats: emptyAccountThresholdStats(),
      departments: new Map(),
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function getOrCreateDepartmentBucket(
  bucket: AccountThresholdTopBucket,
  key: string,
  unit: string,
  order: number
): AccountThresholdDepartmentBucket {
  let department = bucket.departments.get(key);
  if (!department) {
    department = {
      key,
      unit,
      order,
      stats: emptyAccountThresholdStats(),
    };
    bucket.departments.set(key, department);
  }
  return department;
}

function compareAccountThresholdBuckets(
  a: { order: number; unit: string },
  b: { order: number; unit: string }
): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.unit.localeCompare(b.unit, "vi");
}

export async function exportAccountThresholdByUnitExcel(
  filters: BalanceByOrgFilters = {}
): Promise<Buffer> {
  const { fromDate, toDate } = resolveDateRange(filters.dateFrom, filters.dateTo);
  const conditions = [];

  if (fromDate) conditions.push(gte(customers.createdAt, fromDate));
  if (toDate) conditions.push(lte(customers.createdAt, toDate));
  if (filters.branchId) conditions.push(eq(users.branchId, filters.branchId));
  if (filters.departmentId) conditions.push(eq(users.departmentId, filters.departmentId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      accountNumber: customers.accountNumber,
      balance: customers.balance,
      branchId: users.branchId,
      branchCode: branches.code,
      branchName: branches.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.consultantId, users.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(whereClause);

  const topBuckets = new Map<string, AccountThresholdTopBucket>();

  for (const row of rows) {
    const accountNumber = row.accountNumber?.trim();
    if (!accountNumber) continue;

    const stats = buildAccountThresholdStats(row.balance);
    const isPgdBinhTay = isPgdBinhTayDepartment(row.departmentName);
    const isHq = isHqBranch(row.branchCode, row.branchName);
    const isNamHoa = isNamHoaBranch(row.branchCode, row.branchName);

    const topKey = isPgdBinhTay
      ? "pgd-binh-tay"
      : isHq
        ? "hoi-so"
        : isNamHoa
          ? "nam-hoa"
          : `branch:${row.branchId ?? row.branchName ?? "unassigned"}`;
    const topUnit = isPgdBinhTay
      ? "PGD BÌNH TÂY"
      : isHq
        ? "HỘI SỞ"
        : isNamHoa
          ? "NAM HOA"
          : formatOtherBranchLabel(row.branchName);
    const topOrder = isPgdBinhTay ? 2 : isHq ? 1 : isNamHoa ? 3 : 100;

    const topBucket = getOrCreateTopBucket(topBuckets, topKey, topUnit, topOrder);
    addAccountThresholdStats(topBucket.stats, stats);

    if (isHq && !isPgdBinhTay) {
      const deptKey = row.departmentId ?? row.departmentName ?? "unassigned-department";
      const department = getOrCreateDepartmentBucket(
        topBucket,
        deptKey,
        formatDepartmentLabel(row.departmentName),
        getDepartmentOrder(row.departmentName)
      );
      addAccountThresholdStats(department.stats, stats);
    }
  }

  const reportRows: AccountThresholdReportRow[] = [];
  const totalStats = emptyAccountThresholdStats();
  const sortedTopBuckets = Array.from(topBuckets.values()).sort(compareAccountThresholdBuckets);

  let topIndex = 1;
  for (const bucket of sortedTopBuckets) {
    reportRows.push({
      stt: topIndex,
      unit: bucket.unit,
      stats: bucket.stats,
      bold: true,
    });
    addAccountThresholdStats(totalStats, bucket.stats);

    if (bucket.key === "hoi-so") {
      const sortedDepartments = Array.from(bucket.departments.values()).sort(
        compareAccountThresholdBuckets
      );
      let departmentIndex = 1;
      for (const department of sortedDepartments) {
        reportRows.push({
          stt: `${topIndex}.${departmentIndex}`,
          unit: department.unit,
          stats: department.stats,
        });
        departmentIndex += 1;
      }
    }

    topIndex += 1;
  }

  reportRows.push({
    stt: null,
    unit: "TỔNG CỘNG",
    stats: totalStats,
    bold: true,
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bao cao tai khoan");

  sheet.columns = [
    { header: "STT", key: "stt", width: 10 },
    { header: "ĐƠN VỊ", key: "unit", width: 30 },
    { header: "SL TÀI KHOẢN", key: "accountCount", width: 16 },
    { header: "TK CÓ SỐ DƯ", key: "positiveBalanceCount", width: 16 },
    { header: "TK CÓ SD TRÊN 50K", key: "over50kCount", width: 20 },
    { header: "%HT TRÊN TỔNG SỐ 50K", key: "completionRate", width: 24 },
    { header: "DƯ/TR ĐỒNG", key: "balance", width: 22 },
    { header: "GHI CHÚ", key: "notes", width: 22 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7EAF0" },
  };

  for (const row of reportRows) {
    const worksheetRow = sheet.addRow({
      stt: row.stt,
      unit: row.unit,
      accountCount: row.stats.accountCount,
      positiveBalanceCount: row.stats.positiveBalanceCount,
      over50kCount: row.stats.over50kCount,
      completionRate: formatCompletionRate(row.stats),
      balance: row.stats.totalBalance,
      notes: "",
    });

    if (row.bold) {
      worksheetRow.font = { bold: true };
    }
  }

  sheet.getColumn(1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getColumn(2).alignment = { horizontal: "left", vertical: "middle" };
  for (const col of [3, 4, 5, 6, 7]) {
    sheet.getColumn(col).alignment = { horizontal: "right", vertical: "middle" };
  }
  sheet.getColumn(7).numFmt = "#,##0";

  for (const row of sheet.getRows(1, sheet.rowCount) ?? []) {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  const totalRow = sheet.getRow(sheet.rowCount);
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDE6EA" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
