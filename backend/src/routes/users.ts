import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { DevelopmentStage, RoleCode, type Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";
import { pick, readWorkbook } from "../utils/excel.js";
import { normalizeCell } from "../utils/labels.js";
import { buildRankings } from "../utils/rankings.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

function publicUserSelect() {
  return {
    id: true,
    name: true,
    studentNo: true,
    workNo: true,
    phone: true,
    email: true,
    developmentStage: true,
    batch: true,
    branch: true,
    dormitory: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    role: { select: { code: true, name: true } }
  } satisfies Prisma.UserSelect;
}

function mapStage(input: unknown): DevelopmentStage {
  const text = String(input ?? "");
  if (text.includes("发展对象")) return DevelopmentStage.DEVELOPMENT_OBJECT;
  if (text.includes("预备")) return DevelopmentStage.PROBATIONARY_MEMBER;
  if (text.includes("正式") || text === "党员" || text.includes("中共党员")) return DevelopmentStage.FULL_MEMBER;
  return DevelopmentStage.ACTIVIST;
}

router.get(
  "/",
  authorize(managerRoles),
  cacheGet(),
  asyncHandler(async (req, res) => {
    const { keyword, developmentStage, batch, sortByPoints } = req.query;
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(keyword
          ? {
              OR: [
                { name: { contains: String(keyword), mode: "insensitive" } },
                { studentNo: { contains: String(keyword), mode: "insensitive" } },
                { workNo: { contains: String(keyword), mode: "insensitive" } }
              ]
            }
          : {}),
        ...(developmentStage ? { developmentStage: String(developmentStage) as never } : {}),
        ...(batch ? { batch: String(batch) } : {})
      },
      select: { ...publicUserSelect(), participations: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      orderBy: { createdAt: "desc" }
    });
    const totals = await prisma.pointsRecord.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((user) => user.id) } },
      _sum: { pointsChange: true }
    });
    const totalMap = new Map(totals.map((item) => [item.userId, item._sum.pointsChange ?? 0]));

    const mapped = users.map((user) => ({
      ...user,
      totalPoints: totalMap.get(user.id) ?? 0,
      latestParticipationAt: user.participations[0]?.createdAt ?? null
    }));
    ok(res, sortByPoints === "true" ? mapped.sort((a, b) => b.totalPoints - a.totalPoints) : mapped);
  })
);

router.get(
  "/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        ...publicUserSelect(),
        pointRecords: { orderBy: { createdAt: "desc" }, include: { activity: true, operator: { select: { name: true } } } },
        participations: { include: { activity: true }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!user) throw new HttpError(404, "成员不存在");
    ok(res, user);
  })
);

router.post(
  "/",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const actor = req.user!;
    const { role = RoleCode.STUDENT, password = "123456", ...data } = req.body;
    if (actor.role === RoleCode.ASSISTANT && role !== RoleCode.STUDENT) {
      throw new HttpError(403, "支部助理不能创建管理账号");
    }
    const roleRecord = await prisma.role.findUnique({ where: { code: role } });
    if (!roleRecord) throw new HttpError(400, "角色不存在");
    const passwordHash = await bcrypt.hash(password || "123456", 10);
    const user = await prisma.user.create({
      data: { ...data, passwordHash, roleId: roleRecord.id },
      select: publicUserSelect()
    });
    ok(res, user);
  })
);

router.put(
  "/:id",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target) throw new HttpError(404, "成员不存在");
    if (req.user!.role === RoleCode.ASSISTANT && target.role.code === RoleCode.SECRETARY) {
      throw new HttpError(403, "支部助理不能修改书记/老师账号");
    }
    const { role, password, ...data } = req.body;
    if (req.user!.role === RoleCode.ASSISTANT && role && role !== RoleCode.STUDENT) {
      throw new HttpError(403, "支部助理不能设置管理角色");
    }
    const roleRecord = role ? await prisma.role.findUnique({ where: { code: role } }) : null;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(roleRecord ? { roleId: roleRecord.id } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
      },
      select: publicUserSelect()
    });
    ok(res, user);
  })
);

router.delete(
  "/:id",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target) throw new HttpError(404, "成员不存在");
    if (target.id === req.user!.id) throw new HttpError(400, "不能删除当前登录账号");
    if (req.user!.role === RoleCode.ASSISTANT && target.role.code !== RoleCode.STUDENT) {
      throw new HttpError(403, "支部助理只能删除普通学生账号");
    }
    const suffix = `deleted_${Date.now()}_${target.id}`;
    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: "DISABLED",
        studentNo: target.studentNo ? `${target.studentNo}_${suffix}` : null,
        workNo: target.workNo ? `${target.workNo}_${suffix}` : null,
        phone: target.phone ? `${target.phone}_${suffix}` : null,
        email: target.email ? `deleted_${Date.now()}_${target.email}` : null
      }
    });
    ok(res, true);
  })
);

router.post(
  "/import",
  authorize(managerRoles),
  upload.single("file"),
  asyncHandler<AuthRequest>(async (req, res) => {
    if (!req.file) throw new HttpError(400, "请上传 Excel 文件");
    const studentRole = await prisma.role.findUnique({ where: { code: RoleCode.STUDENT } });
    if (!studentRole) throw new HttpError(500, "缺少普通学生角色");
    const rows = readWorkbook(req.file.buffer);
    const passwordHash = await bcrypt.hash("123456", 10);
    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = normalizeCell(pick(row, ["姓名", "名字", "学生姓名"]));
      const accountNo = normalizeCell(pick(row, ["学号", "学号/工号", "学生学号", "工号", "账号"]));
      if (!name || !accountNo) {
        skipped += 1;
        continue;
      }
      const existed = await prisma.user.findFirst({ where: { OR: [{ studentNo: accountNo }, { workNo: accountNo }] } });
      if (existed) {
        skipped += 1;
        continue;
      }
      await prisma.user.create({
        data: {
          name,
          studentNo: accountNo,
          passwordHash,
          roleId: studentRole.id,
          developmentStage: mapStage(pick(row, ["发展阶段", "阶段", "党员类型"])),
          batch: normalizeCell(pick(row, ["所属批次", "批次", "年级"])) || null,
          branch: normalizeCell(pick(row, ["所属支部", "支部"])) || null,
          dormitory: normalizeCell(pick(row, ["寝室号", "宿舍", "寝室"])) || null
        }
      });
      created += 1;
    }
    ok(res, { created, skipped });
  })
);

router.get(
  "/:id/rank-context",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new HttpError(404, "成员不存在");
    const rankings = await buildRankings({ batch: user.batch ?? undefined });
    ok(res, rankings.find((item) => item.id === user.id) ?? null);
  })
);

export default router;
