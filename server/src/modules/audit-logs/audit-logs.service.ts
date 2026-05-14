import { db } from "../../config/database.js";
import { auditLogs } from "../../db/schema/auditLogs.js";
import { users } from "../../db/schema/users.js";
import { eq, and, desc, count } from "drizzle-orm";

export interface AuditLogQuery {
  page: number;
  limit: number;
  action?: string;
  resource?: string;
  userId?: string;
}

export async function list(query: AuditLogQuery) {
  const conditions = [];

  if (query.action) {
    conditions.push(eq(auditLogs.action, query.action));
  }
  if (query.resource) {
    conditions.push(eq(auditLogs.resource, query.resource));
  }
  if (query.userId) {
    conditions.push(eq(auditLogs.userId, query.userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        userName: users.fullName,
        employeeCode: users.employeeCode,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(auditLogs).where(whereClause),
  ]);

  return { data, total };
}
