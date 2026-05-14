import { db } from "../config/database.js";
import { permissions } from "./schema/roles.js";

export const PERMISSIONS_DATA: Array<{ resource: string; action: string }> = [
  // Customers
  { resource: "customers", action: "create" },
  { resource: "customers", action: "read" },
  { resource: "customers", action: "update" },
  { resource: "customers", action: "delete" },
  { resource: "customers", action: "export" },
  { resource: "customers", action: "import" },
  { resource: "customers", action: "read_all" },
  { resource: "customers", action: "claim" },
  { resource: "customers", action: "unclaim" },
  // Users
  { resource: "users", action: "create" },
  { resource: "users", action: "read" },
  { resource: "users", action: "update" },
  { resource: "users", action: "delete" },
  { resource: "users", action: "import" },
  { resource: "users", action: "export" },
  // Roles
  { resource: "roles", action: "create" },
  { resource: "roles", action: "read" },
  { resource: "roles", action: "update" },
  { resource: "roles", action: "delete" },
  // Permissions
  { resource: "permissions", action: "read" },
  { resource: "permissions", action: "assign" },
  // Dashboard
  { resource: "dashboard", action: "read" },
  // Reports
  { resource: "reports", action: "export" },
  // Audit logs
  { resource: "audit_logs", action: "read" },
  // Organization
  { resource: "organization", action: "read" },
  { resource: "organization", action: "create" },
  { resource: "organization", action: "update" },
  { resource: "organization", action: "delete" },
];

export async function syncPermissions() {
  await db.insert(permissions).values(PERMISSIONS_DATA).onConflictDoNothing();
}
