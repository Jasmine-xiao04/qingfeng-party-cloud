import type { Request } from "express";
import type { RoleCode } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: RoleCode;
  name: string;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};
