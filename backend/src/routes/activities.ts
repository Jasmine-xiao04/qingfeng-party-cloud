import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { prisma } from "../prisma.js";
import { authenticate, authorize, managerRoles } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import type { AuthRequest } from "../types.js";
import { asyncHandler, HttpError, ok } from "../utils/http.js";
import { getActivityStatus } from "../utils/labels.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

function normalizeMinuteDate(input: string | Date) {
  const date = new Date(input);
  date.setSeconds(0, 0);
  return date;
}

router.get(
  "/",
  cacheGet(),
  asyncHandler<AuthRequest>(async (req, res) => {
    const { requiredForMe } = req.query;
    const me =
      requiredForMe === "true"
        ? await prisma.user.findUnique({ where: { id: req.user!.id }, select: { developmentStage: true } })
        : null;
    const activities = await prisma.activity.findMany({
      where:
        requiredForMe === "true" && me
          ? { isRequired: true, requiredStages: { has: me.developmentStage } }
          : undefined,
      include: { publisher: { select: { name: true } }, _count: { select: { participants: true } } },
      orderBy: { activityTime: "desc" }
    });
    ok(
      res,
      activities.map((activity) => ({
        ...activity,
        status: getActivityStatus(activity.activityTime),
        participantCount: activity._count.participants,
        _count: undefined
      }))
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: {
        publisher: { select: { name: true } },
        participants: { include: { user: { select: { id: true, name: true, studentNo: true, developmentStage: true, batch: true } } } },
        pointRecords: { include: { user: { select: { name: true, studentNo: true } } }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!activity) throw new HttpError(404, "活动不存在");
    ok(res, { ...activity, status: getActivityStatus(activity.activityTime) });
  })
);

router.post(
  "/",
  authorize(managerRoles),
  asyncHandler<AuthRequest>(async (req, res) => {
    const activityTime = normalizeMinuteDate(req.body.activityTime);
    const activity = await prisma.activity.create({
      data: {
        ...req.body,
        activityTime,
        basePoints: Number(req.body.basePoints ?? 1),
        publisherId: req.user!.id,
        status: getActivityStatus(activityTime)
      }
    });
    ok(res, activity);
  })
);

router.put(
  "/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const activityTime = req.body.activityTime ? normalizeMinuteDate(req.body.activityTime) : undefined;
    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        ...(activityTime ? { activityTime, status: getActivityStatus(activityTime) } : {}),
        ...(req.body.basePoints !== undefined ? { basePoints: Number(req.body.basePoints) } : {})
      }
    });
    ok(res, activity);
  })
);

router.delete(
  "/:id",
  authorize(managerRoles),
  asyncHandler(async (req, res) => {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!activity) throw new HttpError(404, "活动不存在");

    const [participantCount, pointsCount, importBatchCount] = await prisma.$transaction([
      prisma.activityParticipant.count({ where: { activityId: req.params.id } }),
      prisma.pointsRecord.count({ where: { activityId: req.params.id } }),
      prisma.importBatch.count({ where: { activityId: req.params.id } })
    ]);

    if (participantCount || pointsCount || importBatchCount) {
      throw new HttpError(
        400,
        "该活动已有参与记录、积分流水或导入批次，不能直接删除。请先回滚相关导入，或保留该活动并编辑活动信息。"
      );
    }

    await prisma.activity.delete({ where: { id: req.params.id } });

    ok(res, true);
  })
);

function getField(text: string, names: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = lines.find((line) => new RegExp(`^${escaped}\\s*[：:]\\s*`).test(line));
    if (match) return match.replace(new RegExp(`^${escaped}\\s*[：:]\\s*`), "").trim();
  }
  return "";
}

function getLink(text: string) {
  const explicit = getField(text, ["报名链接", "报名地址", "链接", "报名网址"]);
  const candidate = explicit || text;
  return candidate.match(/https?:\/\/[^\s，。；;）)】>]+/i)?.[0] ?? "";
}

function parseActivityType(value: string) {
  const text = value || "";
  if (/理论|学习/.test(text)) return "THEORY_STUDY";
  if (/主题党日/.test(text)) return "THEME_PARTY_DAY";
  if (/志愿|服务/.test(text)) return "VOLUNTEER_SERVICE";
  if (/支部大会|大会/.test(text)) return "BRANCH_MEETING";
  if (/党课|培训/.test(text)) return "PARTY_CLASS";
  if (/社会实践|实践/.test(text)) return "SOCIAL_PRACTICE";
  if (/组织生活/.test(text)) return "ORGANIZATION_LIFE";
  if (/其他/.test(text)) return "OTHER";
  return undefined;
}

function parseStages(value: string) {
  const text = value || "";
  const stages: string[] = [];
  if (/积极分子|入党积极/.test(text)) stages.push("ACTIVIST");
  if (/发展对象/.test(text)) stages.push("DEVELOPMENT_OBJECT");
  if (/预备党员|预备/.test(text)) stages.push("PROBATIONARY_MEMBER");
  if (/正式党员|正式|中共党员/.test(text)) stages.push("FULL_MEMBER");
  if (/全体|所有|全部/.test(text)) return ["ACTIVIST", "DEVELOPMENT_OBJECT", "PROBATIONARY_MEMBER", "FULL_MEMBER"];
  return [...new Set(stages)];
}

function parseRequired(value: string) {
  const text = value || "";
  if (/自愿|自由|可选|非必须/.test(text)) return false;
  if (/必须|必参加|应参加|需参加|要求参加|全体参加/.test(text)) return true;
  return undefined;
}

function parsePoints(value: string) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function parseDateTime(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text
    .replace(/[年月]/g, "-")
    .replace(/[日号]/g, " ")
    .replace(/[点时]/g, ":")
    .replace(/分/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const now = new Date();
  const full = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2})?:?(\d{1,2})?/);
  const short = normalized.match(/(\d{1,2})-(\d{1,2})\s*(\d{1,2})?:?(\d{1,2})?/);
  const iso = normalized.match(/(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}):(\d{1,2})/);

  const parts = iso
    ? { year: Number(iso[1].split("-")[0]), month: Number(iso[1].split("-")[1]), day: Number(iso[1].split("-")[2]), hour: Number(iso[2]), minute: Number(iso[3]) }
    : full
      ? { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]), hour: Number(full[4] ?? 0), minute: Number(full[5] ?? 0) }
      : short
        ? { year: now.getFullYear(), month: Number(short[1]), day: Number(short[2]), hour: Number(short[3] ?? 0), minute: Number(short[4] ?? 0) }
        : null;

  if (!parts) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : normalizeMinuteDate(parsed).toISOString();
  }

  const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function compactDescription(text: string, parsedValues: string[]) {
  const parsed = new Set(parsedValues.filter(Boolean).map((item) => item.trim()));
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const body = lines.filter((line) => {
    if (parsed.has(line)) return false;
    return !/^(活动名称|主题|标题|活动时间|时间|活动地点|地点|活动类型|类型|参与要求|是否必须|必须参与阶段|必须参与人群|可参与阶段|可参与人群|基础积分|积分|报名链接|报名地址|链接|活动说明|内容|说明)\s*[：:]/.test(line);
  });
  return body.join("\n").slice(0, 1200);
}

router.post(
  "/parse-word",
  authorize(managerRoles),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "请上传 .docx 文件");
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    const text = result.value.trim();
    const title = getField(text, ["活动名称", "活动主题", "主题", "标题"]);
    const rawTime = getField(text, ["活动时间", "时间", "举办时间"]);
    const location = getField(text, ["活动地点", "地点", "举办地点"]);
    const rawType = getField(text, ["活动类型", "类型", "活动类别", "类别"]);
    const rawRequirement = getField(text, ["参与要求", "参加要求", "是否必须", "是否必参加"]);
    const rawRequiredStages = getField(text, ["必须参与阶段", "必须参与人群", "必参加人群", "面向对象", "参与对象"]);
    const rawAllowedStages = getField(text, ["可参与阶段", "可参与人群", "可参加人群", "开放对象"]);
    const rawPoints = getField(text, ["基础积分", "活动基础积分", "积分", "分值"]);
    const signupLink = getLink(text);
    const explicitDescription = getField(text, ["活动说明", "活动内容", "内容", "说明"]);
    const requiredStages = parseStages(rawRequiredStages || rawRequirement);
    const allowedStages = parseStages(rawAllowedStages);
    const isRequired = parseRequired(rawRequirement || rawRequiredStages);
    const parsedValues = [title, rawTime, location, rawType, rawRequirement, rawRequiredStages, rawAllowedStages, rawPoints, signupLink, explicitDescription];
    ok(res, {
      title,
      activityTime: parseDateTime(rawTime),
      location,
      type: parseActivityType(rawType),
      isRequired,
      requiredStages,
      allowedStages,
      basePoints: parsePoints(rawPoints),
      signupLink,
      description: explicitDescription || compactDescription(text, parsedValues),
      missingFields: {
        title: !title,
        activityTime: !rawTime,
        location: !location,
        type: !rawType,
        participation: !rawRequirement && !rawRequiredStages,
        basePoints: !rawPoints,
        signupLink: !signupLink,
        description: !explicitDescription && !compactDescription(text, parsedValues)
      }
    });
  })
);

export default router;
