import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";

const router = Router();
const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { account, password } = req.body as { account?: string; password?: string };
    if (!account || !password) throw new HttpError(400, "请输入账号和密码");

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ studentNo: account }, { workNo: account }, { phone: account }, { email: account }]
      },
      include: { role: true }
    });
    if (!user || user.status !== "ACTIVE") throw new HttpError(401, "账号或密码错误");

    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) throw new HttpError(401, "账号或密码错误");

    const token = jwt.sign({ id: user.id, role: user.role.code, name: user.name }, secret, { expiresIn: "7d" });
    ok(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role.code,
        developmentStage: user.developmentStage,
        batch: user.batch,
        branch: user.branch
      }
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler<AuthRequest>(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true }
    });
    if (!user) throw new HttpError(404, "用户不存在");
    ok(res, {
      id: user.id,
      name: user.name,
      studentNo: user.studentNo,
      workNo: user.workNo,
      phone: user.phone,
      email: user.email,
      role: user.role.code,
      developmentStage: user.developmentStage,
      batch: user.batch,
      branch: user.branch,
      dormitory: user.dormitory
    });
  })
);

router.post("/logout", (_req, res) => ok(res, true));

export default router;
