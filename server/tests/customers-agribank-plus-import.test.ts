import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { auditLogs } from "../src/db/schema/auditLogs.js";
import { customers } from "../src/db/schema/customers.js";
import { users } from "../src/db/schema/users.js";
import * as customersService from "../src/modules/customers/customers.service.js";

function createAgribankPlusXls(
  rows: Array<Record<string, string>>,
  headers: string[] = ["custseq", "mblno1"]
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Agribank Plus");
  return XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;
}

describe("Agribank Plus customer import", () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        employeeCode: "AGPLUS_IMPORT_TEST01",
        passwordHash: "test-password-hash",
        fullName: "Agribank Plus Import Tester",
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
      .where(eq(users.employeeCode, "AGPLUS_IMPORT_TEST01"));
    testUserId = existing.id;
  });

  beforeEach(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
  });

  afterAll(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId));
    await db.delete(users).where(eq(users.employeeCode, "AGPLUS_IMPORT_TEST01"));
  });

  it("updates every customer matching custseq and skips unknown customer codes", async () => {
    const inserted = await db
      .insert(customers)
      .values([
        {
          businessName: "HKD AG Plus Duplicate 1",
          ownerName: "Owner Duplicate 1",
          customerCode: "CUST001",
          phone: "0900000001",
          hasAgribankPlus: false,
          hasAccount: false,
          balance: "0",
          software: "NO",
          customerGroup: 1,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
        {
          businessName: "HKD AG Plus Duplicate 2",
          ownerName: "Owner Duplicate 2",
          customerCode: "CUST001",
          phone: "0900000002",
          hasAgribankPlus: false,
          hasAccount: false,
          balance: "0",
          software: "NO",
          customerGroup: 1,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
        {
          businessName: "HKD AG Plus Other",
          ownerName: "Owner Other",
          customerCode: "CUST002",
          phone: "0900000003",
          hasAgribankPlus: false,
          hasAccount: false,
          balance: "0",
          software: "NO",
          customerGroup: 1,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      ])
      .returning({ id: customers.id });

    const buffer = createAgribankPlusXls([
      { custseq: "CUST001", mblno1: "0987654321" },
      { custseq: "UNKNOWN", mblno1: "0911111111" },
    ]);

    const result = await customersService.importFromFile(
      buffer,
      "agribank-plus.xls",
      testUserId,
      "127.0.0.1",
      "agribankPlus"
    );

    expect(result).toMatchObject({
      success: 0,
      updated: 2,
      skipped: 1,
      errors: [],
    });
    expect(result.skippedRows).toEqual([
      { row: 3, message: 'Không tìm thấy khách hàng có mã "UNKNOWN"' },
    ]);

    const rows = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        phone: customers.phone,
        hasAgribankPlus: customers.hasAgribankPlus,
      })
      .from(customers)
      .where(inArray(customers.id, inserted.map((row) => row.id)));

    expect(rows.filter((row) => row.customerCode === "CUST001")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phone: "0987654321", hasAgribankPlus: true }),
        expect.objectContaining({ phone: "0987654321", hasAgribankPlus: true }),
      ])
    );
    expect(rows.find((row) => row.customerCode === "CUST002")).toMatchObject({
      phone: "0900000003",
      hasAgribankPlus: false,
    });
  });

  it("accepts Agribank Plus headers with spaces and different casing", async () => {
    await db.insert(customers).values({
      businessName: "HKD AG Plus Flexible Header",
      ownerName: "Owner Flexible Header",
      customerCode: "CUST004",
      phone: "0900000004",
      hasAgribankPlus: false,
      hasAccount: false,
      balance: "0",
      software: "NO",
      customerGroup: 1,
      createdBy: testUserId,
      updatedBy: testUserId,
    });

    const buffer = createAgribankPlusXls(
      [{ "CUST SEQ": "CUST004", "mbl no1": "0999999999" }],
      ["CUST SEQ", "mbl no1"]
    );

    const result = await customersService.importFromFile(
      buffer,
      "agribank-plus-flexible-headers.xls",
      testUserId,
      "127.0.0.1",
      "agribankPlus"
    );

    expect(result).toMatchObject({
      success: 0,
      updated: 1,
      skipped: 0,
      errors: [],
    });

    const [updated] = await db
      .select({
        phone: customers.phone,
        hasAgribankPlus: customers.hasAgribankPlus,
      })
      .from(customers)
      .where(eq(customers.customerCode, "CUST004"));

    expect(updated).toMatchObject({
      phone: "0999999999",
      hasAgribankPlus: true,
    });
  });

  it("reports row errors for missing custseq or mblno1 while updating valid rows", async () => {
    await db.insert(customers).values({
      businessName: "HKD AG Plus Valid",
      ownerName: "Owner Valid",
      customerCode: "CUST003",
      phone: null,
      hasAgribankPlus: false,
      hasAccount: false,
      balance: "0",
      software: "NO",
      customerGroup: 1,
      createdBy: testUserId,
      updatedBy: testUserId,
    });

    const buffer = createAgribankPlusXls([
      { custseq: "CUST003", mblno1: "0903333333" },
      { custseq: "", mblno1: "0904444444" },
      { custseq: "CUST005", mblno1: "" },
    ]);

    const result = await customersService.importFromFile(
      buffer,
      "agribank-plus.xls",
      testUserId,
      "127.0.0.1",
      "agribankPlus"
    );

    expect(result).toMatchObject({
      success: 0,
      updated: 1,
      skipped: 0,
      errors: [
        { row: 3, message: "Thiếu custseq" },
        { row: 4, message: "Thiếu mblno1" },
      ],
    });

    const [updated] = await db
      .select({
        phone: customers.phone,
        hasAgribankPlus: customers.hasAgribankPlus,
      })
      .from(customers)
      .where(eq(customers.customerCode, "CUST003"));

    expect(updated).toMatchObject({
      phone: "0903333333",
      hasAgribankPlus: true,
    });
  });

  it("rejects Agribank Plus files missing required headers", async () => {
    const worksheet = XLSX.utils.json_to_sheet([{ customer: "CUST001", phone: "0901111111" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agribank Plus");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;

    await expect(
      customersService.importFromFile(
        buffer,
        "agribank-plus.xls",
        testUserId,
        "127.0.0.1",
        "agribankPlus"
      )
    ).rejects.toThrow("File Agribank Plus thiếu cột bắt buộc: custseq, mblno1");
  });
});
