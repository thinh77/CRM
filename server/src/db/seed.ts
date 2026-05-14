import { db } from "../config/database.js";
import { users, userRoles } from "./schema/users.js";
import { roles, permissions, rolePermissions } from "./schema/roles.js";
import { branches, departments, positions } from "./schema/organization.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { PERMISSIONS_DATA } from "./permissions.js";

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Create permissions
  console.log("  Creating permissions...");
  const insertedPermissions = await db
    .insert(permissions)
    .values(PERMISSIONS_DATA)
    .onConflictDoNothing()
    .returning();

  const allPermissions =
    insertedPermissions.length > 0
      ? insertedPermissions
      : await db.select().from(permissions);

  // 2. Create admin role (system role)
  console.log("  Creating admin role...");
  const [adminRole] = await db
    .insert(roles)
    .values({
      name: "admin",
      description: "Quản trị viên - toàn quyền hệ thống",
      isSystem: true,
    })
    .onConflictDoNothing()
    .returning();

  const finalAdminRole =
    adminRole || (await db.select().from(roles).where(eq(roles.name, "admin")))?.[0];

  // 3. Assign all permissions to admin role
  console.log("  Assigning permissions to admin role...");
  if (finalAdminRole) {
    await db
      .insert(rolePermissions)
      .values(
        allPermissions.map((p) => ({
          roleId: finalAdminRole.id,
          permissionId: p.id,
        }))
      )
      .onConflictDoNothing();
  }

  // 4. Create staff role
  console.log("  Creating staff role...");
  const [staffRole] = await db
    .insert(roles)
    .values({
      name: "staff",
      description: "Cán bộ - quản lý khách hàng được phân công",
      isSystem: false,
    })
    .onConflictDoNothing()
    .returning();

  const finalStaffRole =
    staffRole || (await db.select().from(roles).where(eq(roles.name, "staff")))?.[0];

  // Assign basic permissions to staff
  if (finalStaffRole) {
    const staffPermissionNames = [
      { resource: "customers", action: "create" },
      { resource: "customers", action: "read" },
      { resource: "customers", action: "update" },
      { resource: "organization", action: "read" },
    ];

    const staffPerms = allPermissions.filter((p) =>
      staffPermissionNames.some(
        (sp) => sp.resource === p.resource && sp.action === p.action
      )
    );

    await db
      .insert(rolePermissions)
      .values(
        staffPerms.map((p) => ({
          roleId: finalStaffRole.id,
          permissionId: p.id,
        }))
      )
      .onConflictDoNothing();
  }

  // 4.5. Create organization data
  console.log("  Creating organization data...");

  const [hqBranch] = await db
    .insert(branches)
    .values({ code: "6421", name: "Hội sở" })
    .onConflictDoNothing()
    .returning();
  const finalHqBranch = hqBranch || (await db.select().from(branches).where(eq(branches.code, "6421")))?.[0];

  await db.insert(branches).values({ code: "6221", name: "Chi nhánh Nam Hoa" }).onConflictDoNothing();

  if (finalHqBranch) {
    const hqDepts = [
      "Ban giám đốc", "Phòng KHQLRR", "Phòng TH", "Phòng KTGSNB",
      "Phòng KHDN", "Phòng KHCN", "Phòng KTNQ", "PGD Bình Tây",
    ];
    for (const name of hqDepts) {
      await db.insert(departments).values({ name, branchId: finalHqBranch.id }).onConflictDoNothing();
    }
  }

  const [nhBranch] = await db.select().from(branches).where(eq(branches.code, "6221"));
  if (nhBranch) {
    for (const name of ["Ban giám đốc", "Phòng KH", "Phòng KTNQ"]) {
      await db.insert(departments).values({ name, branchId: nhBranch.id }).onConflictDoNothing();
    }
  }

  const positionData = [
    { name: "Giám đốc", level: 1 },
    { name: "Phó giám đốc", level: 2 },
    { name: "Trưởng phòng", level: 3 },
    { name: "Phó trưởng phòng", level: 4 },
    { name: "Nhân viên", level: 5 },
  ];
  for (const pos of positionData) {
    await db.insert(positions).values(pos).onConflictDoNothing();
  }

  const allDepts = await db.select().from(departments);
  const itDept = allDepts.find((d) => d.name === "Phòng TH" && d.branchId === finalHqBranch?.id);

  // 5. Create admin user
  console.log("  Creating admin user...");
  const passwordHash = await bcrypt.hash("Dientoan@6421", 12);
  const [adminUser] = await db
    .insert(users)
    .values({
      employeeCode: "quantri",
      passwordHash,
      fullName: "Quản trị viên",
      branchId: finalHqBranch?.id || null,
      departmentId: itDept?.id || null,
      positionId: null,
    })
    .onConflictDoNothing()
    .returning();

  // 6. Assign admin role to admin user
  if (adminUser && finalAdminRole) {
    console.log("  Assigning admin role to admin user...");
    await db
      .insert(userRoles)
      .values({
        userId: adminUser.id,
        roleId: finalAdminRole.id,
      })
      .onConflictDoNothing();
  }

  console.log("✅ Seeding completed!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
