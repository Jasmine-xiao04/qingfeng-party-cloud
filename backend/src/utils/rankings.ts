import { prisma } from "../prisma.js";

export async function buildRankings(filters: { batch?: string; developmentStage?: string } = {}) {
  const users = await prisma.user.findMany({
    where: {
      role: { code: { in: ["STUDENT", "ASSISTANT"] } },
      status: "ACTIVE",
      ...(filters.batch ? { batch: filters.batch } : {}),
      ...(filters.developmentStage ? { developmentStage: filters.developmentStage as never } : {})
    },
    select: {
      id: true,
      name: true,
      studentNo: true,
      developmentStage: true,
      batch: true,
      branch: true
    }
  });

  const totals = await prisma.pointsRecord.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((user) => user.id) } },
    _sum: { pointsChange: true }
  });
  const totalMap = new Map(totals.map((item) => [item.userId, item._sum.pointsChange ?? 0]));

  return users
    .map((user) => ({
      ...user,
      totalPoints: totalMap.get(user.id) ?? 0
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
