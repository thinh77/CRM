import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { customers } from "../src/db/schema/customers.js";
import { branches, departments } from "../src/db/schema/organization.js";
import { users } from "../src/db/schema/users.js";
import * as reportsService from "../src/modules/reports/reports.service.js";

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
});
