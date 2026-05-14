import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt.js";
import { db } from "../config/database.js";
import { users, userRoles, userPermissions } from "../db/schema/users.js";
import {
  roles,
  permissions,
  rolePermissions,
} from "../db/schema/roles.js";
import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "./errorHandler.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { permissions: string[] };
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Access token required", 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    // Check if user is active
    const [user] = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user?.isActive) {
      throw new AppError("Account is disabled", 403);
    }

    // Load user permissions
    const userPerms = await getUserPermissions(payload.userId);

    req.user = { ...payload, permissions: userPerms };
    next();
  } catch (err: any) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      next(new AppError("Invalid or expired token", 401));
    } else {
      next(err);
    }
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    // Admin has all permissions
    if (req.user.permissions.includes("*")) {
      return next();
    }

    const hasPermission = requiredPermissions.every((p) =>
      req.user!.permissions.includes(p)
    );

    if (!hasPermission) {
      return next(new AppError("Insufficient permissions", 403));
    }

    next();
  };
}

export function requireAdmin() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!req.user.permissions.includes("*")) {
      return next(new AppError("Admin access required", 403));
    }

    next();
  };
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  // 1. Get user's roles
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRoleRows.length === 0) return [];

  const roleIds = userRoleRows.map((r: { roleId: string }) => r.roleId);

  // Check if user has admin (system) role
  const systemRoles = await db
    .select()
    .from(roles)
    .where(and(inArray(roles.id, roleIds), eq(roles.isSystem, true)));

  if (systemRoles.length > 0) {
    return ["*"]; // Admin gets wildcard permission
  }

  // 2. Get permissions from roles
  const rolePerms = await db
    .select({
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(
      permissions,
      eq(rolePermissions.permissionId, permissions.id)
    )
    .where(inArray(rolePermissions.roleId, roleIds));

  const permSet = new Set<string>(rolePerms.map((p: { resource: string; action: string }) => `${p.resource}:${p.action}`));

  // 3. Apply user-level permission overrides
  const overrides = await db
    .select({
      resource: permissions.resource,
      action: permissions.action,
      granted: userPermissions.granted,
    })
    .from(userPermissions)
    .innerJoin(
      permissions,
      eq(userPermissions.permissionId, permissions.id)
    )
    .where(eq(userPermissions.userId, userId));

  for (const override of overrides) {
    const key = `${override.resource}:${override.action}`;
    if (override.granted) {
      permSet.add(key);
    } else {
      permSet.delete(key);
    }
  }

  return Array.from(permSet);
}
