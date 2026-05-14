import { Router } from "express";
import * as rolesController from "./roles.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRolePermissionsSchema,
} from "./roles.schema.js";
import {
  authenticate,
  requireAdmin,
  requirePermission,
} from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/permissions", requirePermission("permissions:read"), rolesController.listPermissions);
router.get("/", requirePermission("roles:read"), rolesController.list);
router.get("/:id", requirePermission("roles:read"), rolesController.getById);
router.post("/", requireAdmin(), validate(createRoleSchema), rolesController.create);
router.put("/:id", requireAdmin(), validate(updateRoleSchema), rolesController.update);
router.delete("/:id", requireAdmin(), rolesController.remove);
router.put(
  "/:id/permissions",
  requireAdmin(),
  validate(assignRolePermissionsSchema),
  rolesController.assignPermissions
);

export default router;
