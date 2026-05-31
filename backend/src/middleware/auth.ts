import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { RoleCode } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthRequest, AuthUser } from "../types.js";
import { HttpError } from "../utils/http.js";

const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new HttpError(401, "请先登录");

    const payload = jwt.verify(token, secret) as AuthUser;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true }
    });
    if (!user || user.status !== "ACTIVE") throw new HttpError(401, "账号不可用或登录已失效");

    req.user = { id: user.id, role: user.role.code, name: user.name };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "登录已失效"));
  }
}

export function authorize(roles: RoleCode[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "请先登录"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "当前角色无权访问"));
    next();
  };
}

export const managerRoles = [RoleCode.SECRETARY, RoleCode.ASSISTANT];
export const secretaryOnly = [RoleCode.SECRETARY];
