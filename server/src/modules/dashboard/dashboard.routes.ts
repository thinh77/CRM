import { Router } from "express";
import * as dashboardController from "./dashboard.controller.js";
import { authenticate, requirePermission } from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/stats", requirePermission("dashboard:read"), dashboardController.getStats);
router.get("/top-consultants", requirePermission("dashboard:read"), dashboardController.getTopConsultants);

export default router;
