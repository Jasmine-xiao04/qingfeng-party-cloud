import { Router } from "express";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";

const router = Router();
router.use(authenticate);

router.get(
  "/my",
  cacheGet(),
  asyncHandler<AuthRequest>(async (req, res) => {
    const records = await prisma.pointsRecord.findMany({
      where: { userId: req.user!.id },
      include: { activity: true, operator: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
    ok(res, {
      totalPoints: records.reduce((sum, record) => sum + record.pointsChange, 0),
      records
    });
  })
);

router.get(
  "/user/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const records = await prisma.pointsRecord.findMany({
      where: { userId: req.params.id },
      include: { activity: true, operator: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
    ok(res, {
      totalPoints: records.reduce((sum, record) => sum + record.pointsChange, 0),
      records
    });
  })
);

router.get(
  "/records",
  authorize(managerRoles),
  cacheGet(),
  asyncHandler(async (req, res) => {
    const { userId, type } = req.query;
    const records = await prisma.pointsRecord.findMany({
      where: {
        ...(userId ? { userId: String(userId) } : {}),
        ...(type ? { type: String(type) as never } : {})
      },
      include: {
        user: { select: { name: true, studentNo: true, batch: true, developmentStage: true } },
        activity: { select: { title: true } },
        operator: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    ok(res, records);
  })
);

router.post(
  "/adjust",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const { userId, pointsChange, remark } = req.body as { userId?: string; pointsChange?: number; remark?: string };
    if (!userId || pointsChange === undefined) throw new HttpError(400, "缺少成员或积分变化");
    if (!remark?.trim()) throw new HttpError(400, "请填写调整原因");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, "成员不存在");
    const record = await prisma.pointsRecord.create({
      data: { userId, pointsChange: Number(pointsChange), type: "ADMIN_ADJUST", remark, operatorId: req.user!.id }
    });
    ok(res, record);
  })
);

export default router;
