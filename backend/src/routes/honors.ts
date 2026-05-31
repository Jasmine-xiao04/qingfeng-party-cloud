import { Router } from "express";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  cacheGet(),
  asyncHandler<AuthRequest>(async (req, res) => {
    const { admin } = req.query;
    const isManager = req.user!.role === "SECRETARY" || req.user!.role === "ASSISTANT";
    const honors = await prisma.honor.findMany({
      where: admin === "true" && isManager ? undefined : { status: "PUBLISHED" },
      include: { publisher: { select: { name: true } } },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }]
    });
    ok(res, honors);
  })
);

router.get(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const honor = await prisma.honor.findUnique({ where: { id: req.params.id }, include: { publisher: { select: { name: true } } } });
    if (!honor) throw new HttpError(404, "荣誉内容不存在");
    const isManager = req.user!.role === "SECRETARY" || req.user!.role === "ASSISTANT";
    if (!isManager && honor.status !== "PUBLISHED") throw new HttpError(404, "荣誉内容不存在");
    ok(res, honor);
  })
);

router.post(
  "/",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const honor = await prisma.honor.create({
      data: {
        ...req.body,
        publisherId: req.user!.id,
        publishedAt: req.body.status === "DRAFT" ? null : new Date(req.body.publishedAt ?? Date.now())
      }
    });
    ok(res, honor);
  })
);

router.put(
  "/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const honor = await prisma.honor.update({
      where: { id: req.params.id },
      data: { ...req.body, ...(req.body.status === "PUBLISHED" && !req.body.publishedAt ? { publishedAt: new Date() } : {}) }
    });
    ok(res, honor);
  })
);

router.delete(
  "/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    await prisma.honor.delete({ where: { id: req.params.id } });
    ok(res, true);
  })
);

export default router;
