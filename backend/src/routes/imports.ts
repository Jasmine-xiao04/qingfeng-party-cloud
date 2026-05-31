import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { DevelopmentStage, ImportBatchType, ImportMatchStatus, RoleCode, type Prisma, type User } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";
import { parseActivityImportRows, parseHistoryRows, readWorkbook } from "../utils/excel.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate, authorize(managerRoles));

type MatchedUser = Pick<User, "id" | "name" | "studentNo" | "developmentStage" | "batch">;
type MatchResult = {
  status: ImportMatchStatus;
  user: MatchedUser | null;
  reason: string;
};

type ActivityConfirmRow = {
  id?: string;
  userId?: string;
  rawName?: string;
  rawStudentNo?: string;
  pointsChange?: number | string;
  remark?: string;
  matchStatus?: ImportMatchStatus;
  deleted?: boolean;
};

const userSelect = {
  id: true,
  name: true,
  studentNo: true,
  developmentStage: true,
  batch: true
} satisfies Prisma.UserSelect;

function toCleanString(value: unknown) {
  return String(value ?? "").trim();
}

function toPoints(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uploadKey(row: { studentNo: string; name: string }) {
  return row.studentNo || `name:${row.name}`;
}

async function matchUser(studentNo?: string, name?: string): Promise<MatchResult> {
  const cleanNo = toCleanString(studentNo);
  const cleanName = toCleanString(name);

  if (cleanNo) {
    const byNo = await prisma.user.findUnique({ where: { studentNo: cleanNo }, select: userSelect });
    if (byNo) {
      if (cleanName && byNo.name !== cleanName) {
        return {
          status: ImportMatchStatus.ERROR,
          user: byNo,
          reason: `信息冲突：学号匹配到 ${byNo.name}，但 Excel 姓名为 ${cleanName}`
        };
      }
      return { status: ImportMatchStatus.MATCHED, user: byNo, reason: "" };
    }

    if (cleanName) {
      const byName = await prisma.user.findMany({ where: { name: cleanName }, select: userSelect });
      if (byName.length === 1) {
        return {
          status: ImportMatchStatus.ERROR,
          user: byName[0],
          reason: `信息冲突：姓名匹配到成员，但学号 ${cleanNo} 不存在或不一致`
        };
      }
      if (byName.length > 1) {
        return { status: ImportMatchStatus.DUPLICATED_NAME, user: null, reason: "重名待确认：请手动选择正确成员" };
      }
    }

    return { status: ImportMatchStatus.NOT_FOUND, user: null, reason: "未匹配：系统中没有该学号" };
  }

  if (cleanName) {
    const byName = await prisma.user.findMany({ where: { name: cleanName }, select: userSelect });
    if (byName.length === 1) return { status: ImportMatchStatus.MATCHED, user: byName[0], reason: "" };
    if (byName.length > 1) return { status: ImportMatchStatus.DUPLICATED_NAME, user: null, reason: "重名待确认：请手动选择正确成员" };
  }

  return { status: ImportMatchStatus.NOT_FOUND, user: null, reason: "未匹配：未找到对应成员" };
}

async function resolveActivity(req: AuthRequest, defaultPoints: number) {
  const activityId = toCleanString(req.body.activityId);

  if (activityId) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new HttpError(404, "请选择有效活动");
    return activity;
  }

  if (!Number.isFinite(defaultPoints)) throw new HttpError(400, "默认积分无效");
  throw new HttpError(400, "请先在活动管理中发布活动，再选择对应活动导入名单");
}

function recordResponse(record: {
  id: string;
  rawName: string | null;
  rawStudentNo: string | null;
  rawActivityName: string | null;
  pointsChange: number | null;
  matchStatus: ImportMatchStatus;
  errorReason: string | null;
  rawData: Prisma.JsonValue;
}, user: MatchedUser | null) {
  const raw = (record.rawData ?? {}) as Record<string, unknown>;
  return {
    id: record.id,
    rowNumber: raw.__rowNumber ?? "",
    rawName: record.rawName ?? "",
    rawStudentNo: record.rawStudentNo ?? "",
    rawActivityName: record.rawActivityName ?? "",
    pointsChange: record.pointsChange ?? 0,
    remark: toCleanString(raw.remark),
    matchStatus: record.matchStatus,
    errorReason: record.errorReason ?? "",
    user
  };
}

router.get(
  "/batches",
  cacheGet(),
  asyncHandler(async (req, res) => {
    const type = req.query.type ? String(req.query.type) : undefined;
    const batches = await prisma.importBatch.findMany({
      where: type ? { type: type as ImportBatchType } : undefined,
      include: {
        operator: { select: { name: true } },
        activity: { select: { title: true } },
        records: { select: { id: true, matchStatus: true } },
        points: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    ok(
      res,
      batches.map((batch) => ({
        id: batch.id,
        type: batch.type,
        fileName: batch.fileName,
        status: batch.status,
        operator: batch.operator,
        activity: batch.activity,
        createdAt: batch.createdAt,
        confirmedAt: batch.confirmedAt,
        recordsCount: batch.records.length,
        matchedCount: batch.records.filter((record) => record.matchStatus === "MATCHED").length,
        pointsCount: batch.points.length
      }))
    );
  })
);

router.post(
  "/batches/:id/rollback",
  asyncHandler(async (req, res) => {
    const batch = await prisma.importBatch.findUnique({
      where: { id: req.params.id },
      include: { points: true }
    });
    if (!batch) throw new HttpError(404, "导入批次不存在");
    if (batch.status !== "CONFIRMED") throw new HttpError(400, "只有已确认的导入批次可以回滚");

    await prisma.$transaction(
      async (tx) => {
        if (batch.type === "ACTIVITY_LIST" && batch.activityId) {
          const userIds = batch.points.map((point) => point.userId);
          await tx.activityParticipant.deleteMany({
            where: { activityId: batch.activityId, userId: { in: userIds } }
          });
        }
        await tx.pointsRecord.deleteMany({ where: { importBatchId: batch.id } });
        await tx.importBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK" } });
      },
      { maxWait: 10_000, timeout: 20_000 }
    );

    ok(res, { rolledBack: batch.points.length });
  })
);

router.delete(
  "/batches/:id",
  asyncHandler(async (req, res) => {
    const batch = await prisma.importBatch.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true }
    });
    if (!batch) throw new HttpError(404, "导入批次不存在");
    if (batch.status !== "PREVIEWED") throw new HttpError(400, "只有未确认的预览批次可以取消，已确认批次请使用回滚");

    await prisma.$transaction(
      async (tx) => {
        await tx.importRecord.deleteMany({ where: { batchId: batch.id } });
        await tx.importBatch.delete({ where: { id: batch.id } });
      },
      { maxWait: 10_000, timeout: 20_000 }
    );

    ok(res, true);
  })
);

router.post(
  "/activity-preview",
  upload.single("file"),
  asyncHandler<AuthRequest>(async (req, res) => {
    if (!req.file) throw new HttpError(400, "请上传 Excel 文件");

    const requestedDefaultPoints = toPoints(req.body.defaultPoints, 1);
    const activity = await resolveActivity(req, requestedDefaultPoints);
    const fallbackPoints = toPoints(req.body.defaultPoints, activity.basePoints);
    const rows = parseActivityImportRows(readWorkbook(req.file.buffer), fallbackPoints);

    const batch = await prisma.importBatch.create({
      data: {
        type: ImportBatchType.ACTIVITY_LIST,
        fileName: req.file.originalname,
        operatorId: req.user!.id,
        activityId: activity.id
      }
    });

    const seenKeys = new Set<string>();
    const seenUserIds = new Set<string>();
    const records = [];

    for (const row of rows) {
      let matched = await matchUser(row.studentNo, row.name);
      const rawKey = uploadKey(row);

      if (matched.status === ImportMatchStatus.MATCHED && matched.user) {
        if (seenUserIds.has(matched.user.id)) {
          matched = { status: ImportMatchStatus.ERROR, user: matched.user, reason: "重复记录：同一成员在本次名单中重复出现，默认跳过后续记录" };
        } else {
          const existed = await prisma.activityParticipant.findUnique({
            where: { activityId_userId: { activityId: activity.id, userId: matched.user.id } }
          });
          if (existed) {
            matched = { status: ImportMatchStatus.ERROR, user: matched.user, reason: "重复记录：该成员已存在此活动参与记录，避免重复加分" };
          } else {
            seenUserIds.add(matched.user.id);
          }
        }
      } else if (seenKeys.has(rawKey)) {
        matched = { status: ImportMatchStatus.ERROR, user: matched.user, reason: "重复记录：同一姓名/学号在本次名单中重复出现" };
      }
      seenKeys.add(rawKey);

      const rawData = { ...row.raw, __rowNumber: row.rowNumber, remark: row.remark };
      const record = await prisma.importRecord.create({
        data: {
          batchId: batch.id,
          userId: matched.status === ImportMatchStatus.MATCHED ? matched.user?.id : null,
          rawName: row.name,
          rawStudentNo: row.studentNo,
          rawActivityName: row.activityName || activity.title,
          pointsChange: row.pointsChange,
          matchStatus: matched.status,
          errorReason: matched.reason,
          rawData: rawData as Prisma.InputJsonValue
        }
      });
      records.push(recordResponse(record, matched.user));
    }

    ok(res, {
      batchId: batch.id,
      activity: { id: activity.id, title: activity.title, basePoints: activity.basePoints },
      records,
      summary: {
        total: records.length,
        matched: records.filter((record) => record.matchStatus === ImportMatchStatus.MATCHED).length,
        failed: records.filter((record) => record.matchStatus !== ImportMatchStatus.MATCHED).length
      }
    });
  })
);

router.post(
  "/activity-confirm",
  asyncHandler<AuthRequest>(async (req, res) => {
    const { batchId, records = [] } = req.body as { batchId?: string; records?: ActivityConfirmRow[] };
    if (!batchId) throw new HttpError(400, "缺少导入批次");

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { records: true, activity: true }
    });
    if (!batch || batch.type !== ImportBatchType.ACTIVITY_LIST || !batch.activityId || !batch.activity) {
      throw new HttpError(404, "导入批次不存在");
    }
    if (batch.status !== "PREVIEWED") throw new HttpError(400, "该批次已处理");
    const activity = batch.activity;

    const storedMap = new Map(batch.records.map((record) => [record.id, record]));
    const incomingRows: ActivityConfirmRow[] = records.length
      ? records.filter((record) => !record.deleted && record.id && storedMap.has(record.id))
      : batch.records.map((record) => ({ id: record.id, userId: record.userId ?? undefined, matchStatus: record.matchStatus }));

    const seenUserIds = new Set<string>();
    let imported = 0;
    let skippedDuplicate = 0;
    let unmatched = 0;
    let abnormal = 0;
    let totalPoints = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const incoming of incomingRows) {
          const stored = storedMap.get(incoming.id!);
          if (!stored) continue;

          const userId = toCleanString(incoming.userId ?? stored.userId);
          const status = incoming.matchStatus ?? stored.matchStatus;
          if (!userId) {
            unmatched += 1;
            continue;
          }
          if (status !== ImportMatchStatus.MATCHED) {
            abnormal += 1;
            continue;
          }
          if (seenUserIds.has(userId)) {
            skippedDuplicate += 1;
            await tx.importRecord.update({
              where: { id: stored.id },
              data: { matchStatus: ImportMatchStatus.ERROR, errorReason: "重复记录：本次确认中同一成员重复出现，已跳过" }
            });
            continue;
          }

          const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
          if (!user) {
            unmatched += 1;
            continue;
          }

          const existed = await tx.activityParticipant.findUnique({
            where: { activityId_userId: { activityId: batch.activityId!, userId } }
          });
          if (existed) {
            skippedDuplicate += 1;
            await tx.importRecord.update({
              where: { id: stored.id },
              data: { userId, matchStatus: ImportMatchStatus.ERROR, errorReason: "重复记录：该成员已存在此活动参与记录，已跳过" }
            });
            continue;
          }

          const points = toPoints(incoming.pointsChange ?? stored.pointsChange, activity.basePoints);
          const remarkText = toCleanString(incoming.remark);
          const remark = remarkText || `活动名单导入：${activity.title}`;
          const rawData = { ...((stored.rawData ?? {}) as Record<string, unknown>), remark };

          await tx.importRecord.update({
            where: { id: stored.id },
            data: {
              userId,
              rawName: toCleanString(incoming.rawName ?? stored.rawName) || stored.rawName,
              rawStudentNo: toCleanString(incoming.rawStudentNo ?? stored.rawStudentNo) || stored.rawStudentNo,
              pointsChange: points,
              matchStatus: ImportMatchStatus.MATCHED,
              errorReason: null,
              rawData: rawData as Prisma.InputJsonValue
            }
          });
          await tx.activityParticipant.create({
            data: {
              activityId: batch.activityId!,
              userId,
              points,
              remark,
              isParticipated: points >= 0,
              checkinStatus: points >= 0 ? "CHECKED_IN" : "ABSENT"
            }
          });
          await tx.pointsRecord.create({
            data: {
              userId,
              activityId: batch.activityId!,
              pointsChange: points,
              type: points >= 0 ? "ACTIVITY_ADD" : "ACTIVITY_DEDUCT",
              remark,
              operatorId: req.user!.id,
              importBatchId: batch.id
            }
          });

          seenUserIds.add(userId);
          imported += 1;
          totalPoints += points;
        }

        await tx.importBatch.update({
          where: { id: batch.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() }
        });
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    ok(res, {
      imported,
      successCount: imported,
      skippedDuplicate,
      unmatched,
      abnormal,
      failed: unmatched + abnormal + skippedDuplicate,
      totalPoints
    });
  })
);

router.post(
  "/history-preview",
  upload.single("file"),
  asyncHandler<AuthRequest>(async (req, res) => {
    if (!req.file) throw new HttpError(400, "请上传 Excel 文件");
    const rows = parseHistoryRows(readWorkbook(req.file.buffer));
    const batch = await prisma.importBatch.create({
      data: { type: ImportBatchType.HISTORY_POINTS, fileName: req.file.originalname, operatorId: req.user!.id }
    });
    const records = [];
    for (const row of rows) {
      const matched = await matchUser(row.studentNo, row.name);
      const existingHistory = matched.user ? await prisma.pointsRecord.findFirst({ where: { userId: matched.user.id, type: "HISTORY_IMPORT" } }) : null;
      const status = existingHistory ? ImportMatchStatus.ERROR : matched.status;
      const reason = existingHistory ? "该成员已存在历史积分导入记录" : matched.reason;
      const record = await prisma.importRecord.create({
        data: {
          batchId: batch.id,
          userId: status === ImportMatchStatus.MATCHED ? matched.user?.id : null,
          rawName: row.name,
          rawStudentNo: row.studentNo,
          pointsChange: row.historyPoints,
          matchStatus: status,
          errorReason: reason,
          rawData: row.raw as Prisma.InputJsonValue
        }
      });
      records.push({ ...record, user: matched.user ? { id: matched.user.id, name: matched.user.name, studentNo: matched.user.studentNo } : null });
    }
    ok(res, { batchId: batch.id, records });
  })
);

function mapStage(input: unknown): DevelopmentStage {
  const text = String(input ?? "");
  if (text.includes("发展对象")) return DevelopmentStage.DEVELOPMENT_OBJECT;
  if (text.includes("预备")) return DevelopmentStage.PROBATIONARY_MEMBER;
  if (text.includes("正式") || text === "党员" || text.includes("中共党员")) return DevelopmentStage.FULL_MEMBER;
  return DevelopmentStage.ACTIVIST;
}

router.post(
  "/history-confirm",
  asyncHandler<AuthRequest>(async (req, res) => {
    const { batchId, createMissing = false } = req.body as { batchId?: string; createMissing?: boolean };
    if (!batchId) throw new HttpError(400, "缺少导入批次");
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, include: { records: true } });
    if (!batch || batch.type !== ImportBatchType.HISTORY_POINTS) throw new HttpError(404, "导入批次不存在");
    if (batch.status !== "PREVIEWED") throw new HttpError(400, "该批次已处理");
    const studentRole = await prisma.role.findUnique({ where: { code: RoleCode.STUDENT } });
    if (!studentRole) throw new HttpError(500, "缺少普通学生角色");
    const defaultPasswordHash = await bcrypt.hash("123456", 10);

    let imported = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const record of batch.records) {
          let userId = record.userId;
          if (!userId && createMissing && record.matchStatus === "NOT_FOUND") {
            const raw = record.rawData as Record<string, unknown>;
            const created = await tx.user.create({
              data: {
                name: record.rawName || "未命名成员",
                studentNo: record.rawStudentNo || undefined,
                passwordHash: defaultPasswordHash,
                roleId: studentRole.id,
                developmentStage: mapStage(raw["发展阶段"] ?? raw["阶段"]),
                batch: String(raw["所属批次"] ?? raw["批次"] ?? "") || null,
                branch: String(raw["所属支部"] ?? raw["支部"] ?? "") || null,
                dormitory: String(raw["寝室号"] ?? raw["寝室"] ?? "") || null
              }
            });
            userId = created.id;
          }
          if (!userId || record.matchStatus === "ERROR" || record.matchStatus === "DUPLICATED_NAME") continue;
          await tx.pointsRecord.create({
            data: {
              userId,
              pointsChange: record.pointsChange ?? 0,
              type: "HISTORY_IMPORT",
              remark: "历史积分导入",
              operatorId: req.user!.id,
              importBatchId: batch.id
            }
          });
          imported += 1;
        }
        await tx.importBatch.update({ where: { id: batch.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
    ok(res, { imported });
  })
);

export default router;
