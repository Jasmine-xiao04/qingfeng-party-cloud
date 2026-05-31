import type { ActivityStatus } from "@prisma/client";

export function getActivityStatus(activityTime: Date): ActivityStatus {
  const now = Date.now();
  const time = activityTime.getTime();
  if (time > now) return "NOT_STARTED";
  if (now - time <= 1000 * 60 * 60 * 6) return "ONGOING";
  return "ENDED";
}

export function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}
