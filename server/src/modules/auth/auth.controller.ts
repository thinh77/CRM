import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service.js";
import { success } from "../../utils/apiResponse.js";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.refresh(req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logout(req.user!.userId);
    success(res, { message: "Đăng xuất thành công" });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.userId);
    success(res, { ...user, permissions: req.user!.permissions });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await authService.changePassword(req.user!.userId, req.body);
    success(res, { message: "Đổi mật khẩu thành công" });
  } catch (err) {
    next(err);
  }
}
