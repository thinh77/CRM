import { db } from "../../config/database.js";
import { branches, departments, positions } from "../../db/schema/organization.js";
import { eq, and, count, ilike } from "drizzle-orm";
import { AppError } from "../../middleware/errorHandler.js";

// ---- Branches ----
export async function listBranches() {
  return db.select().from(branches).orderBy(branches.code);
}

export async function getBranch(id: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, id));
  if (!branch) throw new AppError("Chi nhánh không tồn tại", 404);
  return branch;
}

export async function createBranch(data: { code: string; name: string }) {
  const [existing] = await db.select().from(branches).where(eq(branches.code, data.code));
  if (existing) throw new AppError("Mã chi nhánh đã tồn tại", 409);
  const [branch] = await db.insert(branches).values(data).returning();
  return branch;
}

export async function updateBranch(id: string, data: { code?: string; name?: string; isActive?: boolean }) {
  await getBranch(id);
  if (data.code) {
    const [dup] = await db.select().from(branches).where(and(eq(branches.code, data.code)));
    if (dup && dup.id !== id) throw new AppError("Mã chi nhánh đã tồn tại", 409);
  }
  const [updated] = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
  return updated;
}

export async function deleteBranch(id: string) {
  await getBranch(id);
  const [{ total }] = await db.select({ total: count() }).from(departments).where(eq(departments.branchId, id));
  if (total > 0) throw new AppError("Không thể xóa chi nhánh đang có phòng ban", 400);
  await db.delete(branches).where(eq(branches.id, id));
}

// ---- Departments ----
export async function listDepartments(branchId?: string) {
  if (branchId) {
    return db
      .select({ id: departments.id, name: departments.name, branchId: departments.branchId, branchName: branches.name, isActive: departments.isActive, createdAt: departments.createdAt })
      .from(departments)
      .leftJoin(branches, eq(departments.branchId, branches.id))
      .where(eq(departments.branchId, branchId))
      .orderBy(departments.name);
  }
  return db
    .select({ id: departments.id, name: departments.name, branchId: departments.branchId, branchName: branches.name, isActive: departments.isActive, createdAt: departments.createdAt })
    .from(departments)
    .leftJoin(branches, eq(departments.branchId, branches.id))
    .orderBy(departments.name);
}

export async function getDepartment(id: string) {
  const [dept] = await db
    .select({ id: departments.id, name: departments.name, branchId: departments.branchId, branchName: branches.name, isActive: departments.isActive, createdAt: departments.createdAt })
    .from(departments)
    .leftJoin(branches, eq(departments.branchId, branches.id))
    .where(eq(departments.id, id));
  if (!dept) throw new AppError("Phòng ban không tồn tại", 404);
  return dept;
}

export async function createDepartment(data: { name: string; branchId: string }) {
  await getBranch(data.branchId);
  const [existing] = await db.select().from(departments).where(and(eq(departments.name, data.name), eq(departments.branchId, data.branchId)));
  if (existing) throw new AppError("Phòng ban đã tồn tại trong chi nhánh này", 409);
  const [dept] = await db.insert(departments).values(data).returning();
  return getDepartment(dept.id);
}

export async function updateDepartment(id: string, data: { name?: string; branchId?: string; isActive?: boolean }) {
  const existing = await getDepartment(id);
  if (data.name || data.branchId) {
    const checkName = data.name || existing.name;
    const checkBranch = data.branchId || existing.branchId;
    const [dup] = await db.select().from(departments).where(and(eq(departments.name, checkName), eq(departments.branchId, checkBranch)));
    if (dup && dup.id !== id) throw new AppError("Phòng ban đã tồn tại trong chi nhánh này", 409);
  }
  const [updated] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
  return getDepartment(updated.id);
}

export async function deleteDepartment(id: string) {
  await getDepartment(id);
  await db.delete(departments).where(eq(departments.id, id));
}

// ---- Positions ----
export async function listPositions() {
  return db.select().from(positions).orderBy(positions.level);
}

export async function getPosition(id: string) {
  const [pos] = await db.select().from(positions).where(eq(positions.id, id));
  if (!pos) throw new AppError("Chức vụ không tồn tại", 404);
  return pos;
}

export async function createPosition(data: { name: string; level: number }) {
  const [existing] = await db.select().from(positions).where(eq(positions.name, data.name));
  if (existing) throw new AppError("Tên chức vụ đã tồn tại", 409);
  const [pos] = await db.insert(positions).values(data).returning();
  return pos;
}

export async function updatePosition(id: string, data: { name?: string; level?: number; isActive?: boolean }) {
  await getPosition(id);
  if (data.name) {
    const [dup] = await db.select().from(positions).where(eq(positions.name, data.name));
    if (dup && dup.id !== id) throw new AppError("Tên chức vụ đã tồn tại", 409);
  }
  const [updated] = await db.update(positions).set(data).where(eq(positions.id, id)).returning();
  return updated;
}

export async function deletePosition(id: string) {
  await getPosition(id);
  await db.delete(positions).where(eq(positions.id, id));
}
