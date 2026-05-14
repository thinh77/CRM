import { db } from "../../config/database.js";
import { users } from "../../db/schema/users.js";
import { branches, departments, positions } from "../../db/schema/organization.js";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "../../utils/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type {
  LoginInput,
  RefreshInput,
  ChangePasswordInput,
} from "./auth.schema.js";

export async function login(input: LoginInput) {
  const [row] = await db
    .select({
      user: users,
      branchName: branches.name,
      departmentName: departments.name,
      positionName: positions.name,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(positions, eq(users.positionId, positions.id))
    .where(eq(users.employeeCode, input.employeeCode));

  if (!row) {
    throw new AppError("Mã nhân viên hoặc mật khẩu không đúng", 401);
  }

  const user = row.user;

  if (!user.isActive) {
    throw new AppError("Tài khoản đã bị vô hiệu hóa", 403);
  }

  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError("Mã nhân viên hoặc mật khẩu không đúng", 401);
  }

  const payload = { userId: user.id, employeeCode: user.employeeCode };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Save refresh token & update last login
  await db
    .update(users)
    .set({ refreshToken, lastLogin: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      isActive: user.isActive,
      branchId: user.branchId,
      branchName: row.branchName ?? null,
      departmentId: user.departmentId,
      departmentName: row.departmentName ?? null,
      positionId: user.positionId,
      positionName: row.positionName ?? null,
    },
  };
}

export async function refresh(input: RefreshInput) {
  const payload = verifyRefreshToken(input.refreshToken);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId));

  if (!user || user.refreshToken !== input.refreshToken) {
    throw new AppError("Invalid refresh token", 401);
  }

  if (!user.isActive) {
    throw new AppError("Tài khoản đã bị vô hiệu hóa", 403);
  }

  const newPayload = { userId: user.id, employeeCode: user.employeeCode };
  const accessToken = generateAccessToken(newPayload);
  const refreshToken = generateRefreshToken(newPayload);

  // Token rotation
  await db
    .update(users)
    .set({ refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { accessToken, refreshToken };
}

export async function logout(userId: string) {
  await db
    .update(users)
    .set({ refreshToken: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isValid = await comparePassword(
    input.currentPassword,
    user.passwordHash
  );
  if (!isValid) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400);
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db
    .update(users)
    .set({ passwordHash, refreshToken: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getMe(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      branchId: users.branchId,
      branchName: branches.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      positionId: users.positionId,
      positionName: positions.name,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(positions, eq(users.positionId, positions.id))
    .where(eq(users.id, userId));

  if (!row) {
    throw new AppError("User not found", 404);
  }

  return row;
}
