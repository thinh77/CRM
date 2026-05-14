import { Request, Response, NextFunction } from "express";
import * as orgService from "./organization.service.js";
import { success, created } from "../../utils/apiResponse.js";

// ---- Branches ----
export async function listBranches(_req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.listBranches()); } catch (e) { next(e); }
}
export async function getBranch(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.getBranch(req.params.id as string)); } catch (e) { next(e); }
}
export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try { created(res, await orgService.createBranch(req.body)); } catch (e) { next(e); }
}
export async function updateBranch(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.updateBranch(req.params.id as string, req.body)); } catch (e) { next(e); }
}
export async function deleteBranch(req: Request, res: Response, next: NextFunction) {
  try { await orgService.deleteBranch(req.params.id as string); success(res, { message: "Đã xóa chi nhánh" }); } catch (e) { next(e); }
}

// ---- Departments ----
export async function listDepartments(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.listDepartments(req.query.branchId as string | undefined)); } catch (e) { next(e); }
}
export async function getDepartment(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.getDepartment(req.params.id as string)); } catch (e) { next(e); }
}
export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try { created(res, await orgService.createDepartment(req.body)); } catch (e) { next(e); }
}
export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.updateDepartment(req.params.id as string, req.body)); } catch (e) { next(e); }
}
export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try { await orgService.deleteDepartment(req.params.id as string); success(res, { message: "Đã xóa phòng ban" }); } catch (e) { next(e); }
}

// ---- Positions ----
export async function listPositions(_req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.listPositions()); } catch (e) { next(e); }
}
export async function getPosition(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.getPosition(req.params.id as string)); } catch (e) { next(e); }
}
export async function createPosition(req: Request, res: Response, next: NextFunction) {
  try { created(res, await orgService.createPosition(req.body)); } catch (e) { next(e); }
}
export async function updatePosition(req: Request, res: Response, next: NextFunction) {
  try { success(res, await orgService.updatePosition(req.params.id as string, req.body)); } catch (e) { next(e); }
}
export async function deletePosition(req: Request, res: Response, next: NextFunction) {
  try { await orgService.deletePosition(req.params.id as string); success(res, { message: "Đã xóa chức vụ" }); } catch (e) { next(e); }
}
