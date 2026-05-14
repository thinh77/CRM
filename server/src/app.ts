import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import rolesRoutes from "./modules/roles/roles.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import auditLogsRoutes from "./modules/audit-logs/audit-logs.routes.js";
import organizationRoutes from "./modules/organization/organization.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";

const app = express();

// Trust proxy khi chạy sau nginx (cần cho rate limiter lấy đúng IP client)
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/reports", reportsRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
