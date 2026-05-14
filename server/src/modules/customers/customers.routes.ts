import { Router } from "express";
import * as customersController from "./customers.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  claimSchema,
} from "./customers.schema.js";
import {
  authenticate,
  requirePermission,
} from "../../middleware/auth.middleware.js";
import { upload } from "../../config/upload.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("customers:read"),
  customersController.list
);

router.get(
  "/stats",
  requirePermission("dashboard:read"),
  customersController.getStats
);

router.post(
  "/import",
  requirePermission("customers:import"),
  upload.single("file"),
  customersController.importCustomers
);

router.get(
  "/export",
  requirePermission("customers:read"),
  customersController.exportCustomers
);

router.get(
  "/template",
  requirePermission("customers:read"),
  customersController.downloadTemplate
);

router.get(
  "/pool",
  requirePermission("customers:claim"),
  customersController.listPool
);

router.post(
  "/pool/claim",
  requirePermission("customers:claim"),
  validate(claimSchema),
  customersController.claim
);

router.post(
  "/pool/unclaim",
  requirePermission("customers:unclaim"),
  validate(claimSchema),
  customersController.unclaim
);

router.get(
  "/:id",
  requirePermission("customers:read"),
  customersController.getById
);

router.post(
  "/",
  requirePermission("customers:create"),
  validate(createCustomerSchema),
  customersController.create
);

router.put(
  "/:id",
  requirePermission("customers:update"),
  validate(updateCustomerSchema),
  customersController.update
);

router.delete(
  "/:id",
  requirePermission("customers:delete"),
  customersController.remove
);

export default router;
