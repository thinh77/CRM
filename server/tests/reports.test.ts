import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { customers } from "../src/db/schema/customers.js";
import { branches, departments } from "../src/db/schema/organization.js";
import { users } from "../src/db/schema/users.js";
import * as reportsService from "../src/modules/reports/reports.service.js";

async function ensureBranch(code: string, name: string) {
  const [inserted] = await db
    .insert(branches)
    .values({ code, name })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const [existing] = await db.select().from(branches).where(eq(branches.code, code));
  if (!existing) throw new Error(`Missing branch ${code}`);
  return existing;
}

async function ensureDepartment(name: string, branchId: string) {
  const [inserted] = await db
    .insert(departments)
    .values({ name, branchId })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.name, name), eq(departments.branchId, branchId)));
  if (!existing) throw new Error(`Missing department ${name}`);
  return existing;
}

async function cleanupAccountThresholdReportFixtures() {
  await db.delete(customers).where(eq(customers.businessName, "HQ No Account"));
  await db.delete(customers).where(
    inArray(customers.accountNumber, [
      "RPT50K0000001",
      "RPT50K0000002",
      "RPT50K0000003",
      "RPT50K0000004",
      "RPT50K0000005",
      "RPT50K0000006",
    ])
  );
  await db.delete(users).where(
    inArray(users.employeeCode, [
      "REPORT_50K_HQ",
      "REPORT_50K_PGD",
      "REPORT_50K_CH",
      "REPORT_50K_DBT",
      "REPORT_50K_NH",
    ])
  );
}

const VB51_ACCOUNT_NUMBERS = [
  "RPTVB51KHCN001",
  "RPTVB51KHCN002",
  "RPTVB51PGD001",
  "RPTVB51PGD002",
  "RPTVB51PGD003",
  "RPTVB51PGD004",
  "RPTVB51PGD005",
  "RPTVB51CH001",
  "RPTVB51DBT001",
  "RPTVB51NH001",
  "RPTVB51NH002",
  "RPTVB51NH003",
  "RPTVB51NH004",
  "RPTVB51NH005",
  "RPTVB51NH006",
];

async function cleanupVb51ReportFixtures() {
  await db.delete(customers).where(eq(customers.businessName, "VB51 No Account"));
  await db.delete(customers).where(inArray(customers.accountNumber, VB51_ACCOUNT_NUMBERS));
  await db.delete(users).where(
    inArray(users.employeeCode, [
      "REPORT_VB51_HQ",
      "REPORT_VB51_PGD",
      "REPORT_VB51_CH",
      "REPORT_VB51_DBT",
      "REPORT_VB51_NH",
    ])
  );
}

const VB1763_ACCOUNT_NUMBERS = [
  "RPT1763HQ001",
  "RPT1763HQ002",
  "RPT1763BT001",
  "RPT1763CH001",
  "RPT1763DBT01",
  "RPT1763NH001",
  "RPT1763OTH01",
  "RPT1763OLD01",
];

async function cleanupVb1763ReportFixtures() {
  await db.delete(customers).where(inArray(customers.accountNumber, VB1763_ACCOUNT_NUMBERS));
  await db.delete(users).where(
    inArray(users.employeeCode, [
      "REPORT_1763_HQ_KHCN",
      "REPORT_1763_HQ_KTNQ",
      "REPORT_1763_BT",
      "REPORT_1763_CH",
      "REPORT_1763_DBT",
      "REPORT_1763_NH",
      "REPORT_1763_OTHER",
    ])
  );
}

function formatTodayForReportTest(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

describe("Reports service", () => {
  let testUserId: string;
  let testBranchId: string;
  let testDepartmentId: string;

  beforeAll(async () => {
    const [branch] = await db
      .insert(branches)
      .values({
        code: "RPTTEST",
        name: "Report Test Branch",
      })
      .onConflictDoNothing()
      .returning();
    if (branch) {
      testBranchId = branch.id;
    } else {
      const [existingBranch] = await db
        .select()
        .from(branches)
        .where(eq(branches.code, "RPTTEST"));
      testBranchId = existingBranch.id;
    }

    const [department] = await db
      .insert(departments)
      .values({
        name: "Report Test Department",
        branchId: testBranchId,
      })
      .onConflictDoNothing()
      .returning();
    if (department) {
      testDepartmentId = department.id;
    } else {
      const [existingDepartment] = await db
        .select()
        .from(departments)
        .where(
          and(
            eq(departments.name, "Report Test Department"),
            eq(departments.branchId, testBranchId)
          )
        );
      testDepartmentId = existingDepartment.id;
    }

    const [user] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_TEST01",
        passwordHash: "test-password-hash",
        fullName: "Report Tester",
        branchId: testBranchId,
        departmentId: testDepartmentId,
      })
      .onConflictDoNothing()
      .returning();

    if (user) {
      testUserId = user.id;
      return;
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.employeeCode, "REPORT_TEST01"));
    testUserId = existing.id;

    await db
      .update(users)
      .set({
        branchId: testBranchId,
        departmentId: testDepartmentId,
      })
      .where(eq(users.id, testUserId));
  });

  afterAll(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
    await db.delete(users).where(eq(users.employeeCode, "REPORT_TEST01"));
    await db.delete(departments).where(eq(departments.id, testDepartmentId));
    await db.delete(branches).where(eq(branches.id, testBranchId));
  });

  it("exports branch and department next to consultant and dates at the end of the detail sheet", async () => {
    await db.insert(customers).values({
      businessName: "HKD Report Date Columns",
      ownerName: "Nguyen Report Date",
      hasAccount: false,
      balance: "0",
      hasAgribankPlus: false,
      software: "NO",
      customerGroup: 1,
      consultantId: testUserId,
      createdBy: testUserId,
      updatedBy: testUserId,
      createdAt: new Date("2035-01-15T02:00:00.000Z"),
      updatedAt: new Date("2035-02-20T03:30:00.000Z"),
    });

    const buffer = await reportsService.exportNewCustomersExcel({
      dateFrom: "2035-01-15",
      dateTo: "2035-01-15",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const detailSheet = workbook.getWorksheet("Danh sach KH moi");
    expect(detailSheet).toBeDefined();

    const headerValues = detailSheet!.getRow(1).values as unknown[];
    const consultantHeaderIndex = headerValues.indexOf("CBTV");
    const branchHeaderIndex = headerValues.indexOf("Chi nhánh");
    const departmentHeaderIndex = headerValues.indexOf("Phòng ban");
    expect(headerValues.slice(consultantHeaderIndex, consultantHeaderIndex + 3)).toEqual([
      "CBTV",
      "Chi nhánh",
      "Phòng ban",
    ]);
    expect(headerValues.slice(-2)).toEqual(["Ngày tạo", "Ngày cập nhật cuối"]);

    const exportedRow = detailSheet!.getRow(2);
    expect(exportedRow.getCell(branchHeaderIndex).value).toBe("Report Test Branch");
    expect(exportedRow.getCell(departmentHeaderIndex).value).toBe("Report Test Department");
    expect(exportedRow.getCell(headerValues.length - 2).value).toBe("15/01/2035");
    expect(exportedRow.getCell(headerValues.length - 1).value).toBe("20/02/2035");
  });

  it("exports account threshold report with each PGD as a separate top-level unit", async () => {
    await cleanupAccountThresholdReportFixtures();

    const hqBranch = await ensureBranch("6421", "Hội sở");
    const namHoaBranch = await ensureBranch("6221", "Chi nhánh Nam Hoa");
    const khcnDept = await ensureDepartment("Phòng KHCN", hqBranch.id);
    const pgdDept = await ensureDepartment("PGD Bình Tây", hqBranch.id);
    const chanhHungDept = await ensureDepartment("PGD Chánh Hưng", hqBranch.id);
    const dbtDept = await ensureDepartment("PGD DBT", hqBranch.id);
    const namHoaDept = await ensureDepartment("Phòng KH", namHoaBranch.id);

    const [hqUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_HQ",
        passwordHash: "test-password-hash",
        fullName: "HQ Report Tester",
        branchId: hqBranch.id,
        departmentId: khcnDept.id,
      })
      .returning();
    const [pgdUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_PGD",
        passwordHash: "test-password-hash",
        fullName: "PGD Report Tester",
        branchId: hqBranch.id,
        departmentId: pgdDept.id,
      })
      .returning();
    const [namHoaUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_NH",
        passwordHash: "test-password-hash",
        fullName: "Nam Hoa Report Tester",
        branchId: namHoaBranch.id,
        departmentId: namHoaDept.id,
      })
      .returning();
    const [chanhHungUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_CH",
        passwordHash: "test-password-hash",
        fullName: "Chanh Hung Report Tester",
        branchId: hqBranch.id,
        departmentId: chanhHungDept.id,
      })
      .returning();
    const [dbtUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_DBT",
        passwordHash: "test-password-hash",
        fullName: "DBT Report Tester",
        branchId: hqBranch.id,
        departmentId: dbtDept.id,
      })
      .returning();

    await db.insert(customers).values([
      {
        businessName: "HQ Account Over 50K",
        ownerName: "HQ Owner One",
        accountNumber: "RPT50K0000001",
        hasAccount: true,
        balance: "60000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "HQ Account Under 50K",
        ownerName: "HQ Owner Two",
        accountNumber: "RPT50K0000002",
        hasAccount: true,
        balance: "10000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "HQ No Account",
        ownerName: "HQ Owner Three",
        hasAccount: false,
        balance: "900000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "PGD Account",
        ownerName: "PGD Owner",
        accountNumber: "RPT50K0000003",
        hasAccount: true,
        balance: "70000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: pgdUser.id,
        createdBy: pgdUser.id,
        updatedBy: pgdUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "Nam Hoa Account",
        ownerName: "Nam Hoa Owner",
        accountNumber: "RPT50K0000004",
        hasAccount: true,
        balance: "5000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: namHoaUser.id,
        createdBy: namHoaUser.id,
        updatedBy: namHoaUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "Chanh Hung Account",
        ownerName: "Chanh Hung Owner",
        accountNumber: "RPT50K0000005",
        hasAccount: true,
        balance: "80000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: chanhHungUser.id,
        createdBy: chanhHungUser.id,
        updatedBy: chanhHungUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "DBT Account",
        ownerName: "DBT Owner",
        accountNumber: "RPT50K0000006",
        hasAccount: true,
        balance: "40000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: dbtUser.id,
        createdBy: dbtUser.id,
        updatedBy: dbtUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
    ]);

    try {
      const buffer = await reportsService.exportAccountThresholdByUnitExcel({
        dateFrom: "2036-03-10",
        dateTo: "2036-03-10",
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet("Bao cao tai khoan");
      expect(sheet).toBeDefined();

      expect(sheet!.getCell("A1").value).toBe("AGRIBANK CHI NHÁNH BẮC TPHCM");
      expect(sheet!.getCell("B1").master.address).toBe("A1");
      expect(sheet!.getCell("A2").value).toBe("PHÒNG KHÁCH HÀNG CÁ NHÂN");
      expect(sheet!.getCell("B2").master.address).toBe("A2");
      expect(sheet!.getCell("A4").value).toBe("BÁO CÁO KẾT QUẢ HKD THEO VB 894");
      expect(sheet!.getCell("H4").master.address).toBe("A4");
      expect(sheet!.getCell("A5").value).toBe("NGÀY 10/03/2036");
      expect(sheet!.getCell("H5").master.address).toBe("A5");
      expect(sheet!.getRow(7).values).toEqual([
        undefined,
        "STT",
        "ĐƠN VỊ",
        "SL TÀI KHOẢN",
        "TK CÓ SỐ DƯ",
        "TK CÓ SD TRÊN 50K",
        "%HT TRÊN 50K",
        "TỔNG SỐ DƯ/TR ĐỒNG",
        "GHI CHÚ",
      ]);

      const rows = Array.from({ length: sheet!.rowCount - 7 }, (_, index) => sheet!.getRow(index + 8)).map((row) => ({
        stt: row.getCell(1).value,
        unit: row.getCell(2).value,
        accountCount: row.getCell(3).value,
        positiveBalanceCount: row.getCell(4).value,
        over50kCount: row.getCell(5).value,
        completionRate: row.getCell(6).value,
        balance: row.getCell(7).value,
      }));

      expect(rows).toEqual([
        {
          stt: 1,
          unit: "HỘI SỞ",
          accountCount: 2,
          positiveBalanceCount: 2,
          over50kCount: 1,
          completionRate: "50%",
          balance: 70000,
        },
        {
          stt: "1.1",
          unit: "P.KHCN",
          accountCount: 2,
          positiveBalanceCount: 2,
          over50kCount: 1,
          completionRate: "50%",
          balance: 70000,
        },
        {
          stt: 2,
          unit: "PGD BÌNH TÂY",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 1,
          completionRate: "100%",
          balance: 70000,
        },
        {
          stt: 3,
          unit: "PGD CHÁNH HƯNG",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 1,
          completionRate: "100%",
          balance: 80000,
        },
        {
          stt: 4,
          unit: "PGD DBT",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 0,
          completionRate: "0%",
          balance: 40000,
        },
        {
          stt: 5,
          unit: "NAM HOA",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 0,
          completionRate: "0%",
          balance: 5000,
        },
        {
          stt: null,
          unit: "TỔNG CỘNG",
          accountCount: 6,
          positiveBalanceCount: 6,
          over50kCount: 3,
          completionRate: "50%",
          balance: 265000,
        },
      ]);
    } finally {
      await cleanupAccountThresholdReportFixtures();
    }
  });

  it("exports VB1763 using the fixed period, 100K threshold, and thousand-dong balances", async () => {
    await cleanupVb1763ReportFixtures();

    const hqBranch = await ensureBranch("6421", "Hội sở");
    const namHoaBranch = await ensureBranch("6221", "Chi nhánh Nam Hoa");
    const otherBranch = await ensureBranch("1763T", "Chi nhánh khác");
    const khcnDept = await ensureDepartment("Phòng KHCN", hqBranch.id);
    const ktnqDept = await ensureDepartment("Phòng KTNQ", hqBranch.id);
    const binhTayDept = await ensureDepartment("PGD Bình Tây", hqBranch.id);
    const chanhHungDept = await ensureDepartment("PGD Chánh Hưng", hqBranch.id);
    const dbtDept = await ensureDepartment("PGD DBT", hqBranch.id);
    const namHoaDept = await ensureDepartment("Phòng KH", namHoaBranch.id);
    const otherDept = await ensureDepartment("Phòng khác", otherBranch.id);

    const userDefinitions = [
      ["REPORT_1763_HQ_KHCN", "VB1763 KHCN", hqBranch.id, khcnDept.id],
      ["REPORT_1763_HQ_KTNQ", "VB1763 KTNQ", hqBranch.id, ktnqDept.id],
      ["REPORT_1763_BT", "VB1763 Binh Tay", hqBranch.id, binhTayDept.id],
      ["REPORT_1763_CH", "VB1763 Chanh Hung", hqBranch.id, chanhHungDept.id],
      ["REPORT_1763_DBT", "VB1763 DBT", hqBranch.id, dbtDept.id],
      ["REPORT_1763_NH", "VB1763 Nam Hoa", namHoaBranch.id, namHoaDept.id],
      ["REPORT_1763_OTHER", "VB1763 Other", otherBranch.id, otherDept.id],
    ] as const;
    const insertedUsers = await db
      .insert(users)
      .values(
        userDefinitions.map(([employeeCode, fullName, branchId, departmentId]) => ({
          employeeCode,
          passwordHash: "test-password-hash",
          fullName,
          branchId,
          departmentId,
        }))
      )
      .returning();
    const userByCode = new Map(insertedUsers.map((user) => [user.employeeCode, user]));

    const readRows = async () => {
      const buffer = await reportsService.exportVb1763ByUnitExcel();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet("Bao cao VB1763");
      expect(sheet).toBeDefined();

      return {
        sheet: sheet!,
        rows: Array.from({ length: 13 }, (_, index) => sheet!.getRow(index + 11)).map((row) => ({
          stt: row.getCell(1).value,
          unit: row.getCell(2).value as string,
          plan: row.getCell(3).value as number | null,
          accountCount: Number(row.getCell(4).value ?? 0),
          over100kCount: Number(row.getCell(5).value ?? 0),
          completionRate: row.getCell(6).value as number | null,
          balance: Number(row.getCell(7).value ?? 0),
        })),
      };
    };
    const baseline = await readRows();

    const fixtureRows = [
      ["RPT1763HQ001", "REPORT_1763_HQ_KHCN", "50000", "2026-08-01T00:00:00.000Z"],
      ["RPT1763HQ002", "REPORT_1763_HQ_KTNQ", "100000", "2026-12-31T12:00:00.000Z"],
      ["RPT1763BT001", "REPORT_1763_BT", "110000", "2026-09-01T00:00:00.000Z"],
      ["RPT1763CH001", "REPORT_1763_CH", "100000", "2026-10-01T00:00:00.000Z"],
      ["RPT1763DBT01", "REPORT_1763_DBT", "90000", "2026-10-02T00:00:00.000Z"],
      ["RPT1763NH001", "REPORT_1763_NH", "200000", "2026-11-01T00:00:00.000Z"],
      ["RPT1763OTH01", "REPORT_1763_OTHER", "125000", "2026-11-02T00:00:00.000Z"],
      ["RPT1763OLD01", "REPORT_1763_HQ_KHCN", "999000", "2026-07-31T00:00:00.000Z"],
    ] as const;
    await db.insert(customers).values(
      fixtureRows.map(([accountNumber, employeeCode, balance, createdAt]) => {
        const user = userByCode.get(employeeCode)!;
        return {
          businessName: `VB1763 ${accountNumber}`,
          ownerName: `Owner ${accountNumber}`,
          accountNumber,
          hasAccount: true,
          balance,
          hasAgribankPlus: false,
          software: "NO",
          customerGroup: 1,
          consultantId: user.id,
          createdBy: user.id,
          updatedBy: user.id,
          createdAt: new Date(createdAt),
        };
      })
    );

    try {
      const { sheet, rows } = await readRows();
      expect(sheet.getCell("A1").value).toBe("AGRIBANK CHI NHÁNH BẮC TPHCM");
      expect(sheet.getCell("A4").value).toBe("BÁO CÁO KẾT QUẢ TK HKD THEO VB 1763");
      expect(sheet.getCell("A5").value).toBe("(TK HKD mở mới từ 01/08/2026 đến 31/12/2026)");
      expect(sheet.getCell("A9").value).toBe("Đơn vị tính: Tài khoản, Ngàn đồng");
      expect(sheet.getRow(10).values).toEqual([
        undefined,
        "STT",
        "ĐƠN VỊ",
        "KẾ HOẠCH GIAO THEO VB 1763",
        "SỐ LƯỢNG TK HKD TỪ 01/08",
        "SỐ LƯỢNG TK HKD TỪ 01/08 SD TRÊN 100K",
        "TỶ LỆ HOÀN THÀNH",
        "TỔNG SỐ DƯ TK HKD TỪ 01/08",
      ]);
      expect(rows.map(({ stt, unit, plan }) => ({ stt, unit, plan }))).toEqual([
        { stt: 1, unit: "HỘI SỞ", plan: 175 },
        { stt: "1.1", unit: "PHÒNG KHCN", plan: 57 },
        { stt: "1.2", unit: "P.KHDN", plan: 50 },
        { stt: "1.3", unit: "PHÒNG KTNQ", plan: 55 },
        { stt: "1.4", unit: "P.KHRR", plan: 3 },
        { stt: "1.5", unit: "P.TH", plan: 7 },
        { stt: "1.6", unit: "P.KTGS", plan: 3 },
        { stt: 2, unit: "PGD BÌNH TÂY", plan: 50 },
        { stt: 3, unit: "PGD CHÁNH HƯNG", plan: 0 },
        { stt: 4, unit: "PGD DBT", plan: 0 },
        { stt: 5, unit: "NAM HOA", plan: 75 },
        { stt: 6, unit: "KHÁC", plan: null },
        { stt: null, unit: "TỔNG CỘNG", plan: 300 },
      ]);

      const byUnit = new Map(rows.map((row) => [row.unit, row]));
      const baselineByUnit = new Map(baseline.rows.map((row) => [row.unit, row]));
      const expectDelta = (
        unit: string,
        accountCount: number,
        over100kCount: number,
        balance: number
      ) => {
        expect(byUnit.get(unit)!.accountCount - baselineByUnit.get(unit)!.accountCount).toBe(accountCount);
        expect(byUnit.get(unit)!.over100kCount - baselineByUnit.get(unit)!.over100kCount).toBe(over100kCount);
        expect(byUnit.get(unit)!.balance - baselineByUnit.get(unit)!.balance).toBe(balance);
      };
      expectDelta("HỘI SỞ", 2, 1, 150);
      expectDelta("PHÒNG KHCN", 1, 0, 50);
      expectDelta("PHÒNG KTNQ", 1, 1, 100);
      expectDelta("PGD BÌNH TÂY", 1, 1, 110);
      expectDelta("PGD CHÁNH HƯNG", 1, 1, 100);
      expectDelta("PGD DBT", 1, 0, 90);
      expectDelta("NAM HOA", 1, 1, 200);
      expectDelta("KHÁC", 1, 1, 125);
      expectDelta("TỔNG CỘNG", 7, 5, 775);
      expect(byUnit.get("PGD CHÁNH HƯNG")!.completionRate).toBe(0);
      expect(byUnit.get("PGD DBT")!.completionRate).toBe(0);
      expect(byUnit.get("KHÁC")!.completionRate).toBeNull();
    } finally {
      await cleanupVb1763ReportFixtures();
    }
  });

  it("exports VB51 report across all accounts without applying date filters", async () => {
    await cleanupVb51ReportFixtures();

    const hqBranch = await ensureBranch("6421", "Hội sở");
    const namHoaBranch = await ensureBranch("6221", "Chi nhánh Nam Hoa");
    const khcnDept = await ensureDepartment("Phòng KHCN", hqBranch.id);
    const pgdDept = await ensureDepartment("PGD Bình Tây", hqBranch.id);
    const chanhHungDept = await ensureDepartment("PGD Chánh Hưng", hqBranch.id);
    const dbtDept = await ensureDepartment("PGD DBT", hqBranch.id);
    const namHoaDept = await ensureDepartment("Phòng KH", namHoaBranch.id);
    const exportFilters = {
      dateFrom: "1999-01-01",
      dateTo: "1999-01-01",
    };
    const readRows = async () => {
      const buffer = await reportsService.exportVb51ByUnitExcel(exportFilters);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet("Bao cao VB51");
      expect(sheet).toBeDefined();

      return {
        sheet: sheet!,
        rows: Array.from({ length: 12 }, (_, index) => sheet!.getRow(index + 8)).map((row) => ({
          stt: row.getCell(1).value,
          unit: row.getCell(2).value,
          plan: row.getCell(3).value as number,
          accountCount: row.getCell(4).value as number,
          balance: row.getCell(5).value as number,
          completionRate: row.getCell(6).value,
        })),
      };
    };
    const baseline = await readRows();

    const [hqUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_VB51_HQ",
        passwordHash: "test-password-hash",
        fullName: "VB51 HQ Tester",
        branchId: hqBranch.id,
        departmentId: khcnDept.id,
      })
      .returning();
    const [pgdUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_VB51_PGD",
        passwordHash: "test-password-hash",
        fullName: "VB51 PGD Tester",
        branchId: hqBranch.id,
        departmentId: pgdDept.id,
      })
      .returning();
    const [namHoaUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_VB51_NH",
        passwordHash: "test-password-hash",
        fullName: "VB51 Nam Hoa Tester",
        branchId: namHoaBranch.id,
        departmentId: namHoaDept.id,
      })
      .returning();
    const [chanhHungUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_VB51_CH",
        passwordHash: "test-password-hash",
        fullName: "VB51 Chanh Hung Tester",
        branchId: hqBranch.id,
        departmentId: chanhHungDept.id,
      })
      .returning();
    const [dbtUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_VB51_DBT",
        passwordHash: "test-password-hash",
        fullName: "VB51 DBT Tester",
        branchId: hqBranch.id,
        departmentId: dbtDept.id,
      })
      .returning();

    await db.insert(customers).values([
      {
        businessName: "VB51 KHCN One",
        ownerName: "VB51 Owner One",
        accountNumber: "RPTVB51KHCN001",
        hasAccount: true,
        balance: "1000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      },
      {
        businessName: "VB51 KHCN Two",
        ownerName: "VB51 Owner Two",
        accountNumber: "RPTVB51KHCN002",
        hasAccount: true,
        balance: "2000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      },
      {
        businessName: "VB51 No Account",
        ownerName: "VB51 Owner Three",
        hasAccount: false,
        balance: "999999",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        businessName: `VB51 PGD ${index + 1}`,
        ownerName: `VB51 PGD Owner ${index + 1}`,
        accountNumber: `RPTVB51PGD00${index + 1}`,
        hasAccount: true,
        balance: "100",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: pgdUser.id,
        createdBy: pgdUser.id,
        updatedBy: pgdUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        businessName: `VB51 Nam Hoa ${index + 1}`,
        ownerName: `VB51 Nam Hoa Owner ${index + 1}`,
        accountNumber: `RPTVB51NH00${index + 1}`,
        hasAccount: true,
        balance: "100",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: namHoaUser.id,
        createdBy: namHoaUser.id,
        updatedBy: namHoaUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      })),
      {
        businessName: "VB51 Chanh Hung",
        ownerName: "VB51 Chanh Hung Owner",
        accountNumber: "RPTVB51CH001",
        hasAccount: true,
        balance: "700",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: chanhHungUser.id,
        createdBy: chanhHungUser.id,
        updatedBy: chanhHungUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      },
      {
        businessName: "VB51 DBT",
        ownerName: "VB51 DBT Owner",
        accountNumber: "RPTVB51DBT001",
        hasAccount: true,
        balance: "800",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: dbtUser.id,
        createdBy: dbtUser.id,
        updatedBy: dbtUser.id,
        createdAt: new Date("2036-04-15T00:00:00.000Z"),
      },
    ]);

    try {
      const { sheet, rows } = await readRows();

      expect(sheet.getCell("A1").value).toBe("AGRIBANK CHI NHÁNH BẮC TPHCM");
      expect(sheet.getCell("A2").value).toBe("PHÒNG KHÁCH HÀNG CÁ NHÂN");
      expect(sheet.getCell("A4").value).toBe("BÁO CÁO KẾT QUẢ HKD THEO VB 51");
      expect(sheet.getCell("A5").value).toBe(`NGÀY ${formatTodayForReportTest()}`);
      expect(sheet.getRow(7).values).toEqual([
        undefined,
        "STT",
        "ĐƠN VỊ",
        "KẾ HOẠCH GIAO (TÀI KHOẢN)",
        "SL TÀI KHOẢN",
        "TỔNG SỐ DƯ",
        "TỶ LỆ TH SO KẾ HOẠCH",
        "GHI CHÚ",
      ]);

      expect(rows.map(({ stt, unit, plan }) => ({ stt, unit, plan }))).toEqual([
        { stt: 1, unit: "HỘI SỞ", plan: 830 },
        { stt: "1.1", unit: "P.KHCN", plan: 220 },
        { stt: "1.2", unit: "P.KHDN", plan: 150 },
        { stt: "1.3", unit: "P.KTNQ", plan: 300 },
        { stt: 1.4, unit: "P.KHRR", plan: 40 },
        { stt: "1.5", unit: "P.TH", plan: 80 },
        { stt: "1.6", unit: "P.KTGS", plan: 40 },
        { stt: 2, unit: "PGD BÌNH TÂY", plan: 150 },
        { stt: 3, unit: "PGD CHÁNH HƯNG", plan: 0 },
        { stt: 4, unit: "PGD DBT", plan: 0 },
        { stt: 5, unit: "NAM HOA", plan: 520 },
        { stt: null, unit: "TỔNG CỘNG", plan: 1500 },
      ]);
      expect(rows.map((row) => row.completionRate)).toEqual(
        rows.map((row) => row.plan === 0 ? "0%" : `${Math.round((row.accountCount / row.plan) * 100)}%`)
      );

      const byUnit = new Map(rows.map((row) => [row.unit, row]));
      const baselineByUnit = new Map(baseline.rows.map((row) => [row.unit, row]));
      expect(byUnit.get("HỘI SỞ")!.accountCount - baselineByUnit.get("HỘI SỞ")!.accountCount).toBe(2);
      expect(byUnit.get("HỘI SỞ")!.balance - baselineByUnit.get("HỘI SỞ")!.balance).toBe(3000);
      expect(byUnit.get("P.KHCN")!.accountCount - baselineByUnit.get("P.KHCN")!.accountCount).toBe(2);
      expect(byUnit.get("P.KHCN")!.balance - baselineByUnit.get("P.KHCN")!.balance).toBe(3000);
      expect(
        byUnit.get("PGD BÌNH TÂY")!.accountCount -
          baselineByUnit.get("PGD BÌNH TÂY")!.accountCount
      ).toBe(5);
      expect(
        byUnit.get("PGD BÌNH TÂY")!.balance - baselineByUnit.get("PGD BÌNH TÂY")!.balance
      ).toBe(500);
      expect(
        byUnit.get("PGD CHÁNH HƯNG")!.accountCount -
          baselineByUnit.get("PGD CHÁNH HƯNG")!.accountCount
      ).toBe(1);
      expect(
        byUnit.get("PGD DBT")!.accountCount - baselineByUnit.get("PGD DBT")!.accountCount
      ).toBe(1);
      expect(byUnit.get("NAM HOA")!.accountCount - baselineByUnit.get("NAM HOA")!.accountCount).toBe(6);
      expect(byUnit.get("NAM HOA")!.balance - baselineByUnit.get("NAM HOA")!.balance).toBe(600);
      expect(
        byUnit.get("TỔNG CỘNG")!.accountCount -
          baselineByUnit.get("TỔNG CỘNG")!.accountCount
      ).toBe(15);
      expect(byUnit.get("TỔNG CỘNG")!.balance - baselineByUnit.get("TỔNG CỘNG")!.balance).toBe(5600);
    } finally {
      await cleanupVb51ReportFixtures();
    }
  });
});
