import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  decimal,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./users.js";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessName: varchar("business_name", { length: 255 }).notNull(),
    ownerName: varchar("owner_name", { length: 150 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 50 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    hasAccount: boolean("has_account").default(false).notNull(),
    accountNumber: varchar("account_number", { length: 50 }),
    balance: decimal("balance", { precision: 18, scale: 2 }).default("0"),
    hasAgribankPlus: boolean("has_agribank_plus").default(false).notNull(),
    software: varchar("software", { length: 20 }).default("NO").notNull(),
    consultantId: uuid("consultant_id").references(() => users.id),
    leadSource: varchar("lead_source", { length: 100 }),
    customerGroup: integer("customer_group").notNull().default(1),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_customers_consultant").on(table.consultantId),
    index("idx_customers_software").on(table.software),
    index("idx_customers_business_name").on(table.businessName),
    index("idx_customers_owner_name").on(table.ownerName),
    uniqueIndex("idx_customers_account_number").on(table.accountNumber),
    check(
      "software_check",
      sql`${table.software} IN ('MISA', 'VNPAY', 'NO', 'OTHER')`
    ),
    index("idx_customers_customer_group").on(table.customerGroup),
    check(
      "customer_group_check",
      sql`${table.customerGroup} IN (1, 2, 3, 4)`
    ),
  ]
);

export const customersRelations = relations(customers, ({ one }) => ({
  consultant: one(users, {
    fields: [customers.consultantId],
    references: [users.id],
  }),
}));
