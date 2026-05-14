import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { branches, departments, positions } from "./organization.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeCode: varchar("employee_code", { length: 20 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    departmentId: uuid("department_id").references(() => departments.id),
    positionId: uuid("position_id").references(() => positions.id),
    isActive: boolean("is_active").default(true).notNull(),
    refreshToken: text("refresh_token"),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_users_branch").on(table.branchId),
    index("idx_users_department").on(table.departmentId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  userPermissions: many(userPermissions),
}));

// Re-export join tables here to keep user-related schemas together
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}));

export const userPermissions = pgTable("user_permissions", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  permissionId: uuid("permission_id").notNull(),
  granted: boolean("granted").default(true).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.permissionId] }),
]);

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
  })
);
