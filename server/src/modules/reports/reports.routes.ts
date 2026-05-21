import { Router } from "express";
import { authenticate, requirePermission } from "../../middleware/auth.middleware.js";
import * as reportsController from "./reports.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("reports:export"), reportsController.getReport);
router.get("/export", requirePermission("reports:export"), reportsController.exportReport);
router.get("/export-pdf", requirePermission("reports:export"), reportsController.exportPdf);
router.get("/export-balance", requirePermission("reports:export"), reportsController.exportBalanceByOrg);
router.get(
  "/export-account-threshold",
  requirePermission("reports:export"),
  reportsController.exportAccountThresholdByUnit
);

export default router;
