import { Router } from "express";
import { prisma } from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, ok } from "../utils/http.js";
import { buildRankings } from "../utils/rankings.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  cacheGet(),
  asyncHandler<AuthRequest>(async (req, res) => {
    const { batch, developmentStage, scope } = req.query;
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const rankings = await buildRankings({
      batch: scope === "myBatch" ? me?.batch ?? undefined : batch ? String(batch) : undefined,
      developmentStage: scope === "myStage" ? me?.developmentStage : developmentStage ? String(developmentStage) : undefined
    });
    ok(res, rankings);
  })
);

export default router;
