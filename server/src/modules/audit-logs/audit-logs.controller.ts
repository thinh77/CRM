import { Request, Response, NextFunction } from "express";
import * as auditLogsService from "./audit-logs.service.js";
import { auditLogQuerySchema } from "./audit-logs.schema.js";
import { paginated } from "../../utils/apiResponse.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const result = await auditLogsService.list(query);
    paginated(res, result.data, result.total, query.page, query.limit);
  } catch (err) {
    next(err);
  }
}
