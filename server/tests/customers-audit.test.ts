import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { auditLogs } from "../src/db/schema/auditLogs.js";
import { customers } from "../src/db/schema/customers.js";
import { users } from "../src/db/schema/users.js";
import * as customersService from "../src/modules/customers/customers.service.js";
import { hashPassword } from "../src/utils/password.js";

let actorId: string;
let alternateConsultantId: string;

function auditData(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

async function ensureUser(employeeCode: string, fullName: string, passwordHash: string): Promise<string> {
  const [created] = await db
    .insert(users)
    .values({ employeeCode, fullName, passwordHash })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created.id;
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.employeeCode, employeeCode));
  return existing.id;
}

describe("Customer audit logs", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Test@1234");
    actorId = await ensureUser("AUDIT_TEST01", "Audit Tester", passwordHash);
    alternateConsultantId = await ensureUser("AUDIT_TEST02", "Alternate Audit Consultant", passwordHash);
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(inArray(auditLogs.userId, [actorId, alternateConsultantId]));
    await db.delete(customers).where(eq(customers.createdBy, actorId));
    await db.delete(users).where(inArray(users.employeeCode, ["AUDIT_TEST01", "AUDIT_TEST02"]));
  });

  it("records consultant names when customer consultant changes", async () => {
    const customer = await customersService.create(
      {
        businessName: "Audit Consultant Update",
        ownerName: "Audit Update Owner",
        hasAccount: false,
        balance: "0",
        hasAgribankPlus: false,
        software: "NO",
        consultantId: actorId,
      },
      actorId
    );

    await customersService.update(
      customer.id,
      { consultantId: alternateConsultantId },
      actorId,
      true
    );

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "UPDATE"),
          eq(auditLogs.resource, "customers"),
          eq(auditLogs.resourceId, customer.id)
        )
      );

    const oldData = auditData(log.oldData);
    const newData = auditData(log.newData);
    expect(oldData.consultantId).toBe(actorId);
    expect(oldData.consultantName).toBe("Audit Tester");
    expect(newData.consultantId).toBe(alternateConsultantId);
    expect(newData.consultantName).toBe("Alternate Audit Consultant");
  });

  it("records one claim audit log per claimed customer with consultant names", async () => {
    const [first, second, alreadyClaimed] = await db
      .insert(customers)
      .values([
        {
          businessName: "Claim Audit One",
          ownerName: "Claim Audit Owner One",
          hasAccount: false,
          balance: "0",
          hasAgribankPlus: false,
          software: "NO",
          createdBy: actorId,
          updatedBy: actorId,
        },
        {
          businessName: "Claim Audit Two",
          ownerName: "Claim Audit Owner Two",
          hasAccount: false,
          balance: "0",
          hasAgribankPlus: false,
          software: "NO",
          createdBy: actorId,
          updatedBy: actorId,
        },
        {
          businessName: "Claim Audit Already Claimed",
          ownerName: "Claim Audit Owner Already Claimed",
          hasAccount: false,
          balance: "0",
          hasAgribankPlus: false,
          software: "NO",
          consultantId: alternateConsultantId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      ])
      .returning();

    const result = await customersService.claimCustomers(
      [first.id, second.id, alreadyClaimed.id],
      actorId
    );

    expect(result).toEqual({ claimed: 2, alreadyClaimed: 1 });

    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "CLAIM"),
          eq(auditLogs.resource, "customers"),
          inArray(auditLogs.resourceId, [first.id, second.id, alreadyClaimed.id])
        )
      );

    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.resourceId).sort()).toEqual([first.id, second.id].sort());
    for (const log of logs) {
      const oldData = auditData(log.oldData);
      const newData = auditData(log.newData);
      expect(oldData.consultantId).toBeNull();
      expect(oldData.consultantName).toBeNull();
      expect(newData.consultantId).toBe(actorId);
      expect(newData.consultantName).toBe("Audit Tester");
    }
  });

  it("records one unclaim audit log per unclaimed customer with consultant names", async () => {
    const [first, second] = await db
      .insert(customers)
      .values([
        {
          businessName: "Unclaim Audit One",
          ownerName: "Unclaim Audit Owner One",
          hasAccount: false,
          balance: "0",
          hasAgribankPlus: false,
          software: "NO",
          consultantId: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
        {
          businessName: "Unclaim Audit Two",
          ownerName: "Unclaim Audit Owner Two",
          hasAccount: false,
          balance: "0",
          hasAgribankPlus: false,
          software: "NO",
          consultantId: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      ])
      .returning();

    const result = await customersService.unclaimCustomers([first.id, second.id], actorId);

    expect(result).toEqual({ unclaimed: 2 });

    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "UNCLAIM"),
          eq(auditLogs.resource, "customers"),
          inArray(auditLogs.resourceId, [first.id, second.id])
        )
      );

    expect(logs).toHaveLength(2);
    for (const log of logs) {
      const oldData = auditData(log.oldData);
      const newData = auditData(log.newData);
      expect(oldData.consultantId).toBe(actorId);
      expect(oldData.consultantName).toBe("Audit Tester");
      expect(newData.consultantId).toBeNull();
      expect(newData.consultantName).toBeNull();
    }
  });
});
