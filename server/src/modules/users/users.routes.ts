import { Router } from "express";
import * as usersController from "./users.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  assignRolesSchema,
  assignPermissionsSchema,
} from "./users.schema.js";
import {
  authenticate,
  requireAdmin,
  requirePermission,
} from "../../middleware/auth.middleware.js";
import { upload } from "../../config/upload.js";

const router = Router();

router.use(authenticate);

router.post(
  "/import",
  requireAdmin(),
  upload.single("file"),
  usersController.importUsers
);

router.get(
  "/export",
  requireAdmin(),
  usersController.exportUsers
);

router.get(
  "/template",
  requireAdmin(),
  usersController.downloadTemplate
);

router.get("/", requirePermission("users:read"), usersController.list);
router.get("/consultants", requirePermission("customers:read"), usersController.listConsultants);
router.get("/:id/permission-overrides", requireAdmin(), usersController.getPermissionOverrides);
router.get("/:id", requirePermission("users:read"), usersController.getById);

// ADMIN only operations
router.post(
  "/",
  requireAdmin(),
  validate(createUserSchema),
  usersController.create
);
router.put(
  "/:id",
  requireAdmin(),
  validate(updateUserSchema),
  usersController.update
);
router.delete("/:id", requireAdmin(), usersController.remove);
router.put(
  "/:id/roles",
  requireAdmin(),
  validate(assignRolesSchema),
  usersController.assignRoles
);
router.put(
  "/:id/permissions",
  requireAdmin(),
  validate(assignPermissionsSchema),
  usersController.assignPermissions
);

export default router;
