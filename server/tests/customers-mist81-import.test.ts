import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { auditLogs } from "../src/db/schema/auditLogs.js";
import { customers } from "../src/db/schema/customers.js";
import { users } from "../src/db/schema/users.js";
import * as customersService from "../src/modules/customers/customers.service.js";

function createMist81Xls(rows: unknown[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MIST81");
  return XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;
}

describe("MIST81 customer import", () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        employeeCode: "MIST81_IMPORT_TEST01",
        passwordHash: "test-password-hash",
        fullName: "MIST81 Import Tester",
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
      .where(eq(users.employeeCode, "MIST81_IMPORT_TEST01"));
    testUserId = existing.id;
  });

  beforeEach(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
  });

  afterAll(async () => {
    await db.delete(customers).where(eq(customers.createdBy, testUserId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId));
    await db.delete(users).where(eq(users.employeeCode, "MIST81_IMPORT_TEST01"));
  });

  it("imports Customer_No into customerCode", async () => {
    const buffer = createMist81Xls([
      ["Customer_No", "Customer_Name", "Account_Number", "Curent_Balance", "Opening_Date", "Address"],
      ["MIST81-CUST-001", "HKD MIST81 Customer No", "6421000000201", "3,000", "17/03/2020", "Customer No Street"],
    ]);

    const result = await customersService.importFromFile(
      buffer,
      "mist81-customer-no.xls",
      testUserId,
      "127.0.0.1",
      "mist81"
    );

    expect(result).toMatchObject({ success: 1, updated: 0, errors: [] });

    const [imported] = await db
      .select({ customerCode: customers.customerCode })
      .from(customers)
      .where(eq(customers.accountNumber, "6421000000201"));

    expect(imported.customerCode).toBe("MIST81-CUST-001");
  });

  it("does not require Customer_No for MIST81 imports", async () => {
    const buffer = createMist81Xls([
      ["Customer_Name", "Account_Number", "Curent_Balance", "Opening_Date", "Address"],
      ["HKD MIST81 No Customer No", "6421000000202", "1,000", "18/03/2020", "No Customer No Street"],
    ]);

    const result = await customersService.importFromFile(
      buffer,
      "mist81-without-customer-no.xls",
      testUserId,
      "127.0.0.1",
      "mist81"
    );

    expect(result).toMatchObject({ success: 1, updated: 0, errors: [] });

    const [imported] = await db
      .select({ customerCode: customers.customerCode })
      .from(customers)
      .where(eq(customers.accountNumber, "6421000000202"));

    expect(imported.customerCode).toBeNull();
  });

  it("updates customerCode when Customer_No is provided for an existing account number", async () => {
    await db.insert(customers).values({
      businessName: "HKD MIST81 Existing",
      ownerName: "Existing Owner",
      customerCode: "OLD-MIST81-CODE",
      accountNumber: "6421000000203",
      hasAccount: true,
      balance: "0",
      hasAgribankPlus: false,
      software: "NO",
      customerGroup: 1,
      createdBy: testUserId,
      updatedBy: testUserId,
    });

    const buffer = createMist81Xls([
      ["Customer_No", "Customer_Name", "Account_Number", "Curent_Balance", "Opening_Date", "Address"],
      ["NEW-MIST81-CODE", "HKD MIST81 Updated", "6421000000203", "2,000", "19/03/2020", "Updated Street"],
    ]);

    const result = await customersService.importFromFile(
      buffer,
      "mist81-update-customer-no.xls",
      testUserId,
      "127.0.0.1",
      "mist81"
    );

    expect(result).toMatchObject({ success: 0, updated: 1, errors: [] });

    const [updated] = await db
      .select({ customerCode: customers.customerCode })
      .from(customers)
      .where(eq(customers.accountNumber, "6421000000203"));

    expect(updated.customerCode).toBe("NEW-MIST81-CODE");
  });
});
