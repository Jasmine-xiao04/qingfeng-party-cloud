import { Router } from "express";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, ok } from "../utils/http.js";
import { buildRankings } from "../utils/rankings.js";
import { getActivityStatus } from "../utils/labels.js";

const router = Router();
router.use(authenticate);

router.get(
  "/admin",
  authorize(managerRoles),
  cacheGet(),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      membersTotal,
      stages,
      activitiesTotal,
      monthlyActivities,
      monthlyParticipants,
      recentActivities,
      recentPoints,
      rankings,
      requiredActivities
    ] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.groupBy({ by: ["developmentStage"], where: { status: "ACTIVE" }, _count: true }),
      prisma.activity.count(),
      prisma.activity.count({ where: { activityTime: { gte: monthStart } } }),
      prisma.activityParticipant.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.activity.findMany({
        orderBy: { activityTime: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          activityTime: true,
          location: true,
          type: true,
          isRequired: true,
          requiredStages: true,
          basePoints: true,
          _count: { select: { participants: true } }
        }
      }),
      prisma.pointsRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true, studentNo: true } }, activity: { select: { title: true } } }
      }),
      buildRankings(),
      prisma.activity.findMany({
        where: { isRequired: true },
        select: {
          id: true,
          title: true,
          requiredStages: true,
          _count: { select: { participants: true } }
        }
      })
    ]);

    const top10 = rankings.slice(0, 10);
    const requiredCompletion = requiredActivities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      requiredStages: activity.requiredStages,
      completedCount: activity._count.participants
    }));

    ok(res, {
      membersTotal,
      stages: Object.fromEntries(stages.map((item) => [item.developmentStage, item._count])),
      activitiesTotal,
      monthlyActivities,
      monthlyParticipants,
      top10,
      recentActivities: recentActivities.map((activity) => ({
        ...activity,
        participantCount: activity._count.participants,
        _count: undefined,
        status: getActivityStatus(activity.activityTime),
      })),
      recentPoints,
      requiredCompletion
    });
  })
);

router.get(
  "/student",
  cacheGet(),
  asyncHandler<AuthRequest>(async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const [points, requiredActivities, latestActivities, participations, honors, rankings] = await Promise.all([
      prisma.pointsRecord.findMany({ where: { userId: req.user!.id }, include: { activity: true }, orderBy: { createdAt: "desc" } }),
      me
        ? prisma.activity.findMany({
            where: { isRequired: true, requiredStages: { has: me.developmentStage } },
            orderBy: { activityTime: "asc" },
            take: 5
          })
        : Promise.resolve([]),
      prisma.activity.findMany({ orderBy: { activityTime: "desc" }, take: 6 }),
      prisma.activityParticipant.findMany({
        where: { userId: req.user!.id },
        include: { activity: true },
        orderBy: { createdAt: "desc" },
        take: 6
      }),
      prisma.honor.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }], take: 4 }),
      buildRankings({ batch: me?.batch ?? undefined })
    ]);
    ok(res, {
      profile: me,
      totalPoints: points.reduce((sum, record) => sum + record.pointsChange, 0),
      batchRank: rankings.find((item) => item.id === req.user!.id)?.rank ?? null,
      recentPoints: points.slice(0, 6),
      requiredActivities: requiredActivities.map((activity) => ({ ...activity, status: getActivityStatus(activity.activityTime) })),
      latestActivities: latestActivities.map((activity) => ({ ...activity, status: getActivityStatus(activity.activityTime) })),
      participations,
      honors
    });
  })
);

export default router;
