import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { customers } from "../src/db/schema/customers.js";
import { users } from "../src/db/schema/users.js";
import * as reportsService from "../src/modules/reports/reports.service.js";

describe("Reports service", () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_TEST01",
        passwordHash: "test-password-hash",
        fullName: "Report Tester",
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
  });

  afterAll(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
    await db.delete(users).where(eq(users.employeeCode, "REPORT_TEST01"));
  });

  it("exports created and last updated dates as dd/mm/yyyy at the end of the detail sheet", async () => {
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
    expect(headerValues.slice(-2)).toEqual(["Ngày tạo", "Ngày cập nhật cuối"]);

    const exportedRow = detailSheet!.getRow(2);
    expect(exportedRow.getCell(headerValues.length - 2).value).toBe("15/01/2035");
    expect(exportedRow.getCell(headerValues.length - 1).value).toBe("20/02/2035");
  });
});
