import { Request, Response, NextFunction } from "express";
import * as rolesService from "./roles.service.js";
import { success, created } from "../../utils/apiResponse.js";

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await rolesService.list();
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.getById(req.params.id as string);
    success(res, role);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.create(req.body);
    created(res, role);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.update(req.params.id as string, req.body);
    success(res, role);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await rolesService.remove(req.params.id as string);
    success(res, { message: "Đã xóa vai trò" });
  } catch (err) {
    next(err);
  }
}

export async function assignPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.assignPermissions(req.params.id as string, req.body);
    success(res, role);
  } catch (err) {
    next(err);
  }
}

export async function listPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await rolesService.listPermissions();
    success(res, result);
  } catch (err) {
    next(err);
  }
}
