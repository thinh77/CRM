import { Router } from "express";
import * as auditLogsController from "./audit-logs.controller.js";
import { authenticate, requirePermission } from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("audit_logs:read"), auditLogsController.list);

export default router;
