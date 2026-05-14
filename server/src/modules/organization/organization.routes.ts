import { Router } from "express";
import { authenticate, requirePermission } from "../../middleware/auth.middleware.js";
import * as orgCtrl from "./organization.controller.js";

const router = Router();
router.use(authenticate);

// Branches
router.get("/branches", orgCtrl.listBranches);
router.get("/branches/:id", orgCtrl.getBranch);
router.post("/branches", requirePermission("organization", "create"), orgCtrl.createBranch);
router.put("/branches/:id", requirePermission("organization", "update"), orgCtrl.updateBranch);
router.delete("/branches/:id", requirePermission("organization", "delete"), orgCtrl.deleteBranch);

// Departments
router.get("/departments", orgCtrl.listDepartments);
router.get("/departments/:id", orgCtrl.getDepartment);
router.post("/departments", requirePermission("organization", "create"), orgCtrl.createDepartment);
router.put("/departments/:id", requirePermission("organization", "update"), orgCtrl.updateDepartment);
router.delete("/departments/:id", requirePermission("organization", "delete"), orgCtrl.deleteDepartment);

// Positions
router.get("/positions", orgCtrl.listPositions);
router.get("/positions/:id", orgCtrl.getPosition);
router.post("/positions", requirePermission("organization", "create"), orgCtrl.createPosition);
router.put("/positions/:id", requirePermission("organization", "update"), orgCtrl.updatePosition);
router.delete("/positions/:id", requirePermission("organization", "delete"), orgCtrl.deletePosition);

export default router;
