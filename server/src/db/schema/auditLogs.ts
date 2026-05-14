import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  inet,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 20 }).notNull(),
    resource: varchar("resource", { length: 50 }).notNull(),
    resourceId: uuid("resource_id"),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_audit_logs_user").on(table.userId),
    index("idx_audit_logs_resource").on(table.resource, table.resourceId),
    index("idx_audit_logs_created").on(table.createdAt),
  ]
);
