import { db } from "../../config/database.js";
import { roles, permissions, rolePermissions } from "../../db/schema/roles.js";
import { eq } from "drizzle-orm";
import { AppError } from "../../middleware/errorHandler.js";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  AssignRolePermissionsInput,
} from "./roles.schema.js";

export async function list() {
  const allRoles = await db.select().from(roles).orderBy(roles.createdAt);

  // Get permissions for each role
  const result = await Promise.all(
    allRoles.map(async (role) => {
      const perms = await db
        .select({
          id: permissions.id,
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id));

      return { ...role, permissions: perms };
    })
  );

  return result;
}

export async function getById(id: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  if (!role) throw new AppError("Vai trò không tồn tại", 404);

  const perms = await db
    .select({
      id: permissions.id,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, id));

  return { ...role, permissions: perms };
}

export async function create(input: CreateRoleInput) {
  const { permissionIds, ...roleData } = input;

  const [role] = await db.insert(roles).values(roleData).returning();

  if (permissionIds && permissionIds.length > 0) {
    await db.insert(rolePermissions).values(
      permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      }))
    );
  }

  return getById(role.id);
}

export async function update(id: string, input: UpdateRoleInput) {
  const existing = await getById(id);
  if (existing.isSystem) {
    throw new AppError("Không thể sửa vai trò hệ thống", 403);
  }

  await db.update(roles).set(input).where(eq(roles.id, id));
  return getById(id);
}

export async function remove(id: string) {
  const existing = await getById(id);
  if (existing.isSystem) {
    throw new AppError("Không thể xóa vai trò hệ thống", 403);
  }

  await db.delete(roles).where(eq(roles.id, id));
}

export async function assignPermissions(id: string, input: AssignRolePermissionsInput) {
  await getById(id); // Verify exists

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

  if (input.permissionIds.length > 0) {
    await db.insert(rolePermissions).values(
      input.permissionIds.map((permissionId) => ({
        roleId: id,
        permissionId,
      }))
    );
  }

  return getById(id);
}

export async function listPermissions() {
  return db.select().from(permissions).orderBy(permissions.resource, permissions.action);
}
