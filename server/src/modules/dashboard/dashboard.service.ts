import { db } from "../../config/database.js";
import { customers } from "../../db/schema/customers.js";
import { auditLogs } from "../../db/schema/auditLogs.js";
import { count, eq, sql, and } from "drizzle-orm";

export type Period = "today" | "week" | "month";

function getStartDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday as start of week
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      return start;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export async function getStats(userId: string, canViewAll: boolean, period?: Period) {
  const conditions = [];

  if (!canViewAll) {
    conditions.push(eq(customers.consultantId, userId));
  }

  const customerCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const [customerStats] = await db
    .select({
      total: count(),
      withAccount: count(sql`CASE WHEN ${customers.hasAccount} THEN 1 END`),
      withAgribankPlus: count(sql`CASE WHEN ${customers.hasAgribankPlus} THEN 1 END`),
      useMisa: count(sql`CASE WHEN ${customers.software} = 'MISA' THEN 1 END`),
      useVnpay: count(sql`CASE WHEN ${customers.software} = 'VNPAY' THEN 1 END`),
      noSoftware: count(sql`CASE WHEN ${customers.software} = 'NO' THEN 1 END`),
      otherSoftware: count(sql`CASE WHEN ${customers.software} = 'OTHER' THEN 1 END`),
      totalBalance: sql<string>`COALESCE(SUM(${customers.balance}), 0)`,
      group1: count(sql`CASE WHEN ${customers.customerGroup} = 1 THEN 1 END`),
      group2: count(sql`CASE WHEN ${customers.customerGroup} = 2 THEN 1 END`),
      group3: count(sql`CASE WHEN ${customers.customerGroup} = 3 THEN 1 END`),
      group4: count(sql`CASE WHEN ${customers.customerGroup} = 4 THEN 1 END`),
    })
    .from(customers)
    .where(customerCondition);

  // Growth KPIs (only when period is set and user can view all)
  let growth = {
    newCustomers: 0,
    newAgribankPlus: 0,
    newMisa: 0,
    newVnpay: 0,
    newAccount: 0,
  };

  if (period && canViewAll) {
    const startDate = getStartDate(period);
    growth = await getGrowthStats(startDate);
  }

  return {
    customers: customerStats,
    growth,
  };
}

/**
 * Growth KPIs: count distinct customers that gained a feature in the period.
 * Source 1: customers created in period with the feature already set.
 * Source 2: audit_logs UPDATE entries where the feature transitioned (false→true or NO→MISA/VNPAY).
 */
async function getGrowthStats(startDate: Date) {
  const result = await db.execute<{
    new_customers: string;
    new_account: string;
    new_agribank_plus: string;
    new_misa: string;
    new_vnpay: string;
  }>(sql`
    WITH created_in_period AS (
      SELECT id, has_account, has_agribank_plus, software
      FROM customers
      WHERE created_at >= ${startDate}
    ),
    updated_in_period AS (
      SELECT
        a.resource_id,
        a.old_data,
        a.new_data,
        c.has_account AS current_has_account,
        c.has_agribank_plus AS current_has_agribank_plus,
        c.software AS current_software
      FROM audit_logs a
      JOIN customers c ON c.id = a.resource_id
      WHERE a.action = 'UPDATE'
        AND a.resource = 'customers'
        AND a.created_at >= ${startDate}
        AND a.resource_id IS NOT NULL
    )
    SELECT
      (SELECT COUNT(*) FROM created_in_period)::text AS new_customers,

      (SELECT COUNT(DISTINCT id) FROM (
        SELECT id FROM created_in_period WHERE has_account = true
        UNION
        SELECT resource_id AS id FROM updated_in_period
          WHERE (old_data->>'hasAccount')::boolean IS DISTINCT FROM true
            AND (new_data->>'hasAccount')::boolean = true
            AND current_has_account = true
      ) t)::text AS new_account,

      (SELECT COUNT(DISTINCT id) FROM (
        SELECT id FROM created_in_period WHERE has_agribank_plus = true
        UNION
        SELECT resource_id AS id FROM updated_in_period
          WHERE (old_data->>'hasAgribankPlus')::boolean IS DISTINCT FROM true
            AND (new_data->>'hasAgribankPlus')::boolean = true
            AND current_has_agribank_plus = true
      ) t)::text AS new_agribank_plus,

      (SELECT COUNT(DISTINCT id) FROM (
        SELECT id FROM created_in_period WHERE software = 'MISA'
        UNION
        SELECT resource_id AS id FROM updated_in_period
          WHERE old_data->>'software' IS DISTINCT FROM 'MISA'
            AND new_data->>'software' = 'MISA'
            AND current_software = 'MISA'
      ) t)::text AS new_misa,

      (SELECT COUNT(DISTINCT id) FROM (
        SELECT id FROM created_in_period WHERE software = 'VNPAY'
        UNION
        SELECT resource_id AS id FROM updated_in_period
          WHERE old_data->>'software' IS DISTINCT FROM 'VNPAY'
            AND new_data->>'software' = 'VNPAY'
            AND current_software = 'VNPAY'
      ) t)::text AS new_vnpay
  `);

  const row = result.rows[0];
  return {
    newCustomers: Number(row?.new_customers ?? 0),
    newAccount: Number(row?.new_account ?? 0),
    newAgribankPlus: Number(row?.new_agribank_plus ?? 0),
    newMisa: Number(row?.new_misa ?? 0),
    newVnpay: Number(row?.new_vnpay ?? 0),
  };
}

export type TopConsultantType = "total" | "new" | "software";

/**
 * Top 10 consultants:
 * - total: by total customers (all-time)
 * - new: by new customers in selected period
 * - software: by new software registrations (MISA/VNPAY) in selected period
 */
export async function getTopConsultants(period: Period, type: TopConsultantType) {
  if (type === "total") {
    const result = await db.execute<{
      consultantId: string;
      fullName: string;
      employeeCode: string;
      customerCount: string;
    }>(sql`
      SELECT
        c.consultant_id AS "consultantId",
        u.full_name AS "fullName",
        u.employee_code AS "employeeCode",
        COUNT(c.id)::text AS "customerCount"
      FROM customers c
      JOIN users u ON u.id = c.consultant_id
      GROUP BY c.consultant_id, u.full_name, u.employee_code
      ORDER BY COUNT(c.id) DESC, u.full_name ASC
      LIMIT 10
    `);
    return result.rows;
  }

  const startDate = getStartDate(period);

  if (type === "new") {
    const result = await db.execute<{
      consultantId: string;
      fullName: string;
      employeeCode: string;
      customerCount: string;
    }>(sql`
      SELECT
        c.consultant_id AS "consultantId",
        u.full_name AS "fullName",
        u.employee_code AS "employeeCode",
        COUNT(c.id)::text AS "customerCount"
      FROM customers c
      JOIN users u ON u.id = c.consultant_id
      WHERE c.created_at >= ${startDate}
      GROUP BY c.consultant_id, u.full_name, u.employee_code
      ORDER BY COUNT(c.id) DESC, u.full_name ASC
      LIMIT 10
    `);
    return result.rows;
  }

  const result = await db.execute<{
    consultantId: string;
    fullName: string;
    employeeCode: string;
    customerCount: string;
  }>(sql`
    WITH new_software AS (
      SELECT id, consultant_id FROM customers
      WHERE created_at >= ${startDate} AND software IN ('MISA', 'VNPAY')
      UNION
      SELECT a.resource_id AS id, c.consultant_id
      FROM audit_logs a
      JOIN customers c ON c.id = a.resource_id
      WHERE a.action = 'UPDATE'
        AND a.resource = 'customers'
        AND a.created_at >= ${startDate}
        AND a.new_data->>'software' IN ('MISA', 'VNPAY')
        AND COALESCE(a.old_data->>'software', 'NO') NOT IN ('MISA', 'VNPAY')
        AND a.resource_id IS NOT NULL
        AND c.software IN ('MISA', 'VNPAY')
    )
    SELECT
      ns.consultant_id AS "consultantId",
      u.full_name AS "fullName",
      u.employee_code AS "employeeCode",
      COUNT(DISTINCT ns.id)::text AS "customerCount"
    FROM new_software ns
    JOIN users u ON u.id = ns.consultant_id
    GROUP BY ns.consultant_id, u.full_name, u.employee_code
    ORDER BY COUNT(DISTINCT ns.id) DESC, u.full_name ASC
    LIMIT 10
  `);
  return result.rows;
}
