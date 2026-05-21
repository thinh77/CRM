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
    ])
  );
  await db.delete(users).where(
    inArray(users.employeeCode, [
      "REPORT_50K_HQ",
      "REPORT_50K_PGD",
      "REPORT_50K_NH",
    ])
  );
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

  it("exports account threshold report with PGD Binh Tay as a separate top-level unit", async () => {
    await cleanupAccountThresholdReportFixtures();

    const hqBranch = await ensureBranch("6421", "Hội sở");
    const namHoaBranch = await ensureBranch("6221", "Chi nhánh Nam Hoa");
    const khcnDept = await ensureDepartment("Phòng KHCN", hqBranch.id);
    const pgdDept = await ensureDepartment("PGD Bình Tây", hqBranch.id);
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

      const rows = sheet!.getRows(8, sheet!.rowCount - 7)!.map((row) => ({
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
          accountCount: 4,
          positiveBalanceCount: 4,
          over50kCount: 2,
          completionRate: "50%",
          balance: 145000,
        },
      ]);
    } finally {
      await cleanupAccountThresholdReportFixtures();
    }
  });
});
